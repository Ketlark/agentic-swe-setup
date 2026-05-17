---
name: zoom-out
description: Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture.
assumption: Models anchor on the nearest file and don't spontaneously map the broader module graph or caller chain. Re-evaluate when models consistently provide architectural context unprompted.
---

I don't know this area of code well. Go up a layer of abstraction. Give me a map of all the relevant modules and callers, using the project's domain glossary vocabulary.
