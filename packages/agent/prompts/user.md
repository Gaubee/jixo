<CONTEXT_DATA>
<ENVIRONMENT>

- **Job_Name**: `{{task.jobName}}`
- **Task_Runner**: `{{task.runner}}`
- **Current_Task_Max_Turns_Quota**: `{{task.maxTurns}}`
- **Task_Start_Time**: `{{task.startTime}}`

</ENVIRONMENT>

<ACTIVE_SESSION_STATE>

- **Other_Runner_List**:
  ```yaml
  {{task.otherRunners}}
  ```

</ACTIVE_SESSION_STATE>

<WORKSPACE_STRUCTURE>

directory: {{task.cwd}}

files:

```yaml
{{allFiles}}
```

</WORKSPACE_STRUCTURE>
<JOB_DIRS_CHANGE_FILES>

```yaml
{{changedFiles}}
```

</JOB_DIRS_CHANGE_FILES>

<JIXO_ALL_SKILLS>

```yaml
{{allSkills}}
```

</JIXO_ALL_SKILLS>

</CONTEXT_DATA>

<INPUT_FILES>
<FILE id="log_file" path="{{task.log.filepath}}">
<CONTENT>

```md
{{task.log.content}}
```

</CONTENT>
</FILE>

<FILE id="job_file" path="{{task.filepath}}">
<CONTENT>
```md
{{task.content}}
```
</CONTENT>
</FILE>
</INPUT_FILES>

<IMPERATIVE>
Your sole task is to execute turns according to the `JIXO_EXECUTION_PROTOCOL` defined in your system prompt, using the data provided above. Begin `PROTOCOL 0` now.
</IMPERATIVE>
