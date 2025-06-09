<CONTEXT_DATA>
    <ENVIRONMENT>
        - **执行者身份 (Executor_Identity)**: `{{task.name}}`
        - **本轮次配额 (Current_Turn_Quota)**: `{{turn.current}}/{{turn.max}}`
    </ENVIRONMENT>

    <ACTIVE_SESSION_STATE>
        - **活跃执行者列表 (Active_Executor_List)**:
            ```yaml
            {{active_executors}}
            ```
    </ACTIVE_SESSION_STATE>
</CONTEXT_DATA>

<INPUT_FILES>
    <FILE id="日志文件" path="./.jixo/{{task.useLog}}.log.md">
        <CONTENT>
        ```md
        {{task.log}}
        ```
        </CONTENT>
    </FILE>

    <FILE id="任务文件" path="{{task.file}}">
        <CONTENT>
        ```md
        {{task.content}}
        ```
        </CONTENT>
    </FILE>

    <FILE id="工作空间结构" path="{{task.cwd}}">
        <CONTENT>
        ```yaml
        {{allFiles}}
        ```
        </CONTENT>
    </FILE>
</INPUT_FILES>

<IMPERATIVE>
你的唯一任务是使用上方提供的数据，严格按照你的系统提示词 (`system-zh.md`) 中定义的 `JIXO_EXECUTION_PROTOCOL` 来执行一个轮次。现在，开始执行 `协议 0`。
</IMPERATIVE>