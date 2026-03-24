This common/ directory is for code shared between browser and service worker contexts.

If we don't split out code this way, typescript can't typecheck the code because it needs to know if we're using "webworker" or "dom" libraries.
