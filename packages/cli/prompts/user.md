<CONTEXT_DATA>
<ENVIRONMENT>

- **Executor_Identity**: `{{task.executor}}`
- **Executor_Name**: `{{task.name}}`
- **Current_Task_Max_Turn_Quota**: `{{task.maxSteps}}`
- **Task_Start_Time**: `{{task.startTime}}`

</ENVIRONMENT>

<ACTIVE_SESSION_STATE>

- **Active_Executor_List**:
  ```yaml
  {{task.allExecutors}}
  ```

</ACTIVE_SESSION_STATE>
</CONTEXT_DATA>

<INPUT_FILES>
<FILE id="log_file" path="{{task.log.filepath}}">
<CONTENT>

```md
{{task.log.content}}
```

</CONTENT>
</FILE>

<FILE id="task_file" path="{{task.filepath}}">
<CONTENT>
```md
{{task.content}}
```
</CONTENT>
</FILE>

<FILE id="workspace_structure" path="{{task.cwd}}">
<CONTENT>
```yaml
{{allFiles}}
```
</CONTENT>
</FILE>
<FILE id="change_files" path="{{task.dirs}}">
<CONTENT>
```yaml
{{changedFiles}}
```
</CONTENT>
</FILE>
</INPUT_FILES>

<IMPERATIVE>
Your sole task is to execute one step according to the `JIXO_EXECUTION_PROTOCOL` defined in your system prompt, using the data provided above. Begin `PROTOCOL 0` now.
</IMPERATIVE>
