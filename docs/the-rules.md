# The rules

Four rules, learned from watching a push prompt get trained out of people.
All of them live in one `eligible()` call - a single function you can read
in ten seconds and trust.

## 1. Capability first, always

`serviceWorker in navigator && PushManager in window && Notification in
window`. Anything else means no prompt, ever - and no consolation prize.
A prompt that renders and then does nothing on click is worse than no
prompt.

## 2. Permission is a one-way door

If `Notification.permission !== 'default'`, the moment has passed -
permanently. Browsers do not re-ask on your behalf; after a Block, the
only path back is the visitor undoing it in site settings. So `denied`
and `on` are terminal states in the machine: once written, the decider
goes quiet forever.

Corollary: never call `Notification.requestPermission()` speculatively
(e.g. on page load "to check"). Requesting IS asking.

## 3. "Not now" is a cooldown, not a refusal

The visitor who says "not now" said *not yet*. Write a timestamp, stay
quiet for the cooldown (7 days in production), ask again at the next
moment of intent. Ask sooner and you've converted a maybe into a no.

## 4. Ask at the moment of intent

This is the one that moves the number. The prompt is decoupled from page
load entirely. It fires only after the visitor does something that costs
them something - on the production site, favoriting an artist - and even
then 1.2 seconds later, once the favorite's own UI feedback has settled.
Two signals of intent stack: they saved something, and the thing they
saved gives the ask a reason to exist ("we'll ping you when THEY
announce a show").

The copy names the reason. "Turn on push alerts" is a feature. "We'll
ping you the moment Calvin Harris announces a date" is a promise.

## The subscribe flow (the part after yes)

Permission granted is not subscribed. The default flow: fetch the VAPID
public key from your server, register the service worker, subscribe via
`pushManager.subscribe`, POST the subscription to your server. Two
failure modes worth naming:

- **Server says `auth`** - the visitor must be logged in for the
  subscription to attach to their favorites. Unsubscribe client-side
  (don't leave an orphaned subscription) and hand them the login link.
  Asking for push and THEN discovering they need an account still
  converts - the intent is hot.
- **Any throw** - re-enable the button, write nothing to state. A failed
  subscribe must not burn the visitor's one ask.
