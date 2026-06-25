In this file I want to explain about the decisions that I took.
1. What I built and skipped:
- An application built using Fastify (NodeJS) that support JSON and HTML to deliver the report
- I also built a Simple yet Solid folder structure for new coming developer
- Implementation of Gemini AI to help me determine the report when ingesting the free text report
- Adding the file cache for gemini to reduce the cost when extractign the text report
- I skipped using more solid but complex structure
- I skipped DB implementation because of the time strain
- I skipped containerization for now because this app already can run without it
- I skipped building fancy UI using React to reduce the waste of time

2. How I handle reconciliation across nights:
- We assign each event to the morning it belongs to. Especially the night shift runs from 23:00 to 07:00
- Using the Gemin AI to Group the reports into thread. Then from that we can see if the report status still open, newly resolved, or new tonight
- We use the latest report as source of truth. So there might be contradicted/re-opened report
- Then to help the manager, I separate the report category based on the text available in the report

3. How I keep every statement grounded and handle incomplete/contradictory input — and, if I use a model anywhere in the pipeline, how I stop it inventing facts:
- First I use gemini to helps read messy text or even other language than english text for the free text report to summarize/translated the report
- After that gemini is used to to group reports as thread. So it's not state any new facts
- To do that, when extract or summarize the text gemini must include sourceQuote from the input
- Then code checks whether the quote in the extraction does exist from the source. If not then flag it as unverified
- In the prompting part. We tell the gemini to treat all incoming input as data and don't follow any instructions exist in the message. If there's a instruction then flag it as possible injection
- Runs the gemini at temperature 0 with fixed JSON Schema so the output is predictable

5. Where AI helped most, and where it got in the way.
- AI Really help me sees that there's a possible trap in the data which that's the reason we add some restriction in the Gemini prompting
- It also helps me stay on track in the fastest way possible. Without it I don't think this can be done in 2 hours
- But the most helped coming when discussing about how to complete the project with the best outcome in fastest way possible.
- It never got in the way, even though with only little context of the project from BRIEF it and small instructions. AI already understand and even write the context in CLAUDE.md so the AI not going off-track

6. What I'd do in hours 3–6 if I had them.
- If I got the time, I can make it more structured and solid. Like the implementation of Typescript and Linting
- Use better Frontend Framework like React + ShadCN UI so the UI will be good
- Using database instead of caching to increase the performance and data stability
- Use docker to made this app easily deployed and developed
- Harness the fallback logic when parsing the data if LLM isn't available
- Support multiple agent and add the logic to switch between agent if 1 agent hit the limit
- Add security like OAuth and JWT so the report won't be public and accessible by other people
- Add new API to retrieve the report instead of using hardcoded file. The API will support file upload and simple JSON Body request.
- Add multi hotel support middleware and data processing to make this app worked well in different behaviour.

7. One thing that surprised you.
Gladly I ask claude to check the seed data first and good things there's no any malware or command that telling claude to do shady stuff. Fortunately Claude understand and aware on the assigned task without running anything. So I can say that Claude is following the rule to not doing any harms for the users.