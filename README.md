# alert-decider

The rules for when a site may ask to send push notifications, as one
reusable decision layer. Zero dependencies, ES5, injectable anywhere.

Extracted from production, where asking at the moment of intent instead
of page load turned the push opt-in from a background-agent dark pattern
into a feature people say yes to.

## Quick start

```html
<script src="src/alert-decider.js"></script>
<script>
  AlertDecider.init({
    storageKey: 'mySiteAlerts',
    cooldownDays: 7,
    vapidKeyUrl: '/push_api.php?action=vapidkey',
    subscribeUrl: '/push_api.php?action=subscribe',
    signInUrl: '/signin.php',
    onAsk: function (d) {
      // YOUR prompt UI - then tell the decider what happened:
      // d.accepted() / d.later() / (denied is handled inside accepted)
    }
  });

  // fire this when YOUR moment of intent happens:
  document.querySelector('.favorite-btn').addEventListener('click', function () {
    AlertDecider.onIntent();
  });
</script>
```

The decider decides whether the ask may happen; you own the pixels.
A working demo (fake favorite button, no server needed for the state
machine) is in [examples/index.html](examples/index.html).

## The four rules

1. **Capability first** - no push APIs, no prompt, ever
2. **Permission is a one-way door** - denied/on are terminal states
3. **"Not now" is a cooldown** (default 7 days), not a refusal
4. **Ask at the moment of intent** - never on page load

Full reasoning, including the post-yes subscribe flow and its two named
failure modes, in [docs/the-rules.md](docs/the-rules.md).

## API

- `AlertDecider.init(opts)` - storage key, cooldown, your `onAsk`, and
  either the default VAPID flow's endpoints or your own `subscribe` fn
- `AlertDecider.onIntent()` - call when intent fires; returns a promise
  for whether an ask was allowed
- `decider.accepted()` - request permission + subscribe; resolves
  `{ ok, subscription }` or `{ ok: false, reason: 'denied' }`
- `decider.later()` - write the cooldown timestamp

## When not to use it

- If your push prompt already converts on page load, leave it alone
- If you need per-user segments or A/B splitting - this is deliberately
  a state machine, not an experiment framework

## License

MIT
