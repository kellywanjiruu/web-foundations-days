# Reflection

**What was the most difficult concept in the course, and how did you overcome it?**

The hardest concept for me was asynchronous JavaScript — specifically, understanding why `fetch` does not throw on a 404 and why every request needs an `await` and an `ok` check. My first API client silently showed wrong data because I assumed any failure would land in `catch`. I overcame it by doing two things: I read the Day 5 notes until the sentence *"fetch does not throw on HTTP errors"* really stuck, and then I broke my own code on purpose — changing the URL to a non-existent path, and using DevTools → Network to watch the failing request. Seeing the 404 arrive as a **successful** promise with `response.ok === false` finally made it click. I now instinctively write `if (!response.ok) throw new Error(...)` before parsing anything.

**Which part of my capstone would I improve, based on the feedback I received?**

The clearest piece of feedback was to **show the network activity during the demo**. My Project 1 presentation explained caching and read replicas but never opened DevTools → Network, so the audience had to take my word for it. If I presented again, I would open the Network tab during the `POST /notes` step and point at the 201 status, the request payload and the response body, then do the same for a `GET /notes` on a cache hit versus a cache miss. That single change would turn an abstract explanation into something the audience can see — and it directly addresses the Communication and Architecture marks on the rubric.

**What will I learn next?**

I want to build a real backend so my API design becomes code rather than just a document. My plan is: **Node.js and Express** first, because that is the shortest path from my `api.js` client to a working server. Then **PostgreSQL**, to replace JSONPlaceholder with a database I designed myself, using the `users`, `notes`, `tags` and `note_tags` schema from my Day 6 work. After that, **React**, so I can build larger interfaces from reusable components instead of rebuilding the DOM by hand. Longer term, I want to deepen my system design knowledge using *The System Design Primer* and ByteByteGo, and keep practising the basics on freeCodeCamp and JavaScript.info — because fluency comes from repetition, not from reading.
