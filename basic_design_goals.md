# Design Goals

1. Greet user with a very basic page that just says website title (job_seek). Below the slogal should be 'Seek Jobs Easily'
2. Explain the basic steps for job search ->
  a. Find relevant Job opening link.
  b. Store the main keypoints from JD and also the YoE and location (remote/inperson)
  c. Find linkedin connections to ask for referral.
  d. Give them your resume (specifically tailored for this job)
3. The tool makes this entire process easier. Every step in this main 4 step window is tracked by this tool. 
4. We will create a sql db file for each user.
5. This sql db will store ofcourse the user's creds followed by the current job links being tracked.
6. Each job link can have status such as [APPLIED/INTERESTED/ONGOING/ACCEPTED/REJECTED].
7. Each job will then have its data points from the JD, YoE, location.
8. Then each job will have the linkedin connections(profile url) to be approached for asking for referral.
9. Then each job will also have an attached resume specifically for that job. (assume user only uses latex and will upload that)

