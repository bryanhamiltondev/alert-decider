/*!
 * alert-decider - the rules for when a site may ask to send push notifications
 * https://github.com/bryanhamiltondev/alert-decider
 *
 * A push opt-in prompt is easy. Deciding WHEN to show it is the whole
 * problem: ask on page load and you train visitors to slam "Block".
 * alert-decider is the decision layer extracted from production, where it
 * doubled push opt-ins by asking only at the moment of intent.
 *
 * The rules it enforces (all in one localStorage state machine):
 *   1. Never ask if the browser can't do push, or permission isn't 'default'
 *   2. Never ask twice - "denied" and "on" are terminal states
 *   3. "Not now" means a cooldown (default 7 days), not never
 *   4. Ask at the moment of intent, never on page load
 *
 * The moment of intent is yours to define. Wire onIntent() to whatever
 * "this visitor is invested" means on your site - a favorite, a save,
 * a third page-view in a session. On the production site it fires when a
 * visitor favorites an artist, 1.2s later, once the UI has settled.
 *
 * Zero dependencies. ES5 so it can be injected into any page.
 *
 * MIT License
 */
(function () {
  'use strict';

  var DAY = 86400000;

  function readState(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
  function writeState(key, s) { try { localStorage.setItem(key, JSON.stringify(s)); } catch (e2) {} }

  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }

  function b64ToU8(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var u = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) { u[i] = raw.charCodeAt(i); }
    return u;
  }

  function hasSubscription() {
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      return reg ? reg.pushManager.getSubscription() : null;
    }).catch(function () { return null; });
  }

  var API = {
    /**
     * Init the decider.
     * opts.storageKey    - localStorage key for the state machine
     * opts.cooldownDays  - days to stay quiet after "not now" (default 7)
     * opts.onAsk         - called with (decider) when the visitor is eligible
     *                      and the moment of intent fires. YOU render the UI;
     *                      then call decider.accepted()/later()/denied().
     * opts.subscribe     - async function returning a PushSubscription
     *                      (default: VAPID flow via opts.vapidKeyUrl + opts.subscribeUrl)
     */
    init: function (opts) {
      this.key = opts.storageKey || 'alertDeciderV1';
      this.cooldown = (opts.cooldownDays || 7) * DAY;
      this.onAsk = opts.onAsk || function () {};
      this.subscribeFn = opts.subscribe || this._defaultSubscribe(opts);
      return this;
    },

    /** Call when your moment-of-intent fires. Decides whether to ask. */
    onIntent: function () {
      var self = this;
      return this.eligible().then(function (ok) {
        if (ok) { self.onAsk(self); }
        return ok;
      }).catch(function () { return false; });
    },

    /** All four rules in one place. */
    eligible: function () {
      var self = this;
      if (!supported()) { return Promise.resolve(false); }
      if (window.Notification && Notification.permission !== 'default') { return Promise.resolve(false); }
      var st = readState(this.key);
      if (st.denied || st.on) { return Promise.resolve(false); }
      if (st.later && Date.now() - st.later < this.cooldown) { return Promise.resolve(false); }
      return hasSubscription().then(function (s) { return !s; });
    },

    /** Visitor said yes: request permission, subscribe, report the result. */
    accepted: function () {
      var self = this;
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') {
          var stD = readState(self.key); stD.denied = true; writeState(self.key, stD);
          return { ok: false, reason: 'denied' };
        }
        return self.subscribeFn().then(function (sub) {
          var stO = readState(self.key); stO.on = true; writeState(self.key, stO);
          return { ok: true, subscription: sub };
        });
      });
    },

    /** "Not now" - start the cooldown. */
    later: function () {
      var st = readState(this.key); st.later = Date.now(); writeState(this.key, st);
    },

    /** Default subscribe: VAPID key from your server, SW register, pushManager.subscribe. */
    _defaultSubscribe: function (opts) {
      var subscribeUrl = opts.subscribeUrl;
      var signInUrl = opts.signInUrl;
      return function () {
        return fetch(opts.vapidKeyUrl).then(function (r) { return r.json(); }).then(function (k) {
          if (!k.key) { throw new Error('no server key'); }
          return navigator.serviceWorker.register(opts.serviceWorkerUrl || '/sw.js').then(function () {
            return navigator.serviceWorker.ready;
          }).then(function (reg) {
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(k.key) });
          });
        }).then(function (sub) {
          return fetch(subscribeUrl, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub.toJSON())
          }).then(function (r) { return r.json(); }).then(function (j) {
            if (j && j.ok) { return sub; }
            if (j && j.error === 'auth') {
              var err = new Error('auth'); err.auth = true; err.signInUrl = signInUrl; err.subscription = sub;
              throw err;
            }
            throw new Error('subscribe failed');
          });
        });
      };
    }
  };

  window.AlertDecider = API;
})();
