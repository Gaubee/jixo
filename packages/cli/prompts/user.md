<CONTEXT_DATA>
    <ENVIRONMENT>
        - **Executor_Identity**: `{{task.name}}`
        - **Current_Turn_Quota**: `{{turn.current}}/{{turn.max}}`
    </ENVIRONMENT>

    <ACTIVE_SESSION_STATE>
        - **Active_Executor_List**:
            ```yaml
            {{active_executors}}
            ```
    </ACTIVE_SESSION_STATE>
</CONTEXT_DATA>

<INPUT_FILES>
    <FILE id="log_file" path="./.jixo/{{task.useLog}}.log.md">
        <CONTENT>
        ```md
        {{task.log}}
        ```
        </CONTENT>
    </FILE>

    <FILE id="task_file" path="{{task.file}}">
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
</INPUT_FILES>

<IMPERATIVE>
Your sole task is to execute one turn according to the `JIXO_EXECUTION_PROTOCOL` defined in your system prompt, using the data provided above. Begin `PROTOCOL 0` now.
</IMPERATIVE>