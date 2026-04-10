Annotate UI elements in a running app and return structured design feedback.

The user wants to annotate UI elements in their running app and have you apply design changes. This is a continuous annotation session — you will receive multiple batches of annotations until the user is done.

**Instructions — follow these exactly:**

1. Call the `wait_for_annotations` tool from the `promptotype` MCP server. This blocks until the user submits annotations from their browser.
2. When annotations arrive, apply the requested changes to the codebase.
3. After applying, call `wait_for_annotations` again immediately to wait for the next batch.
4. Keep repeating steps 2-3 until `wait_for_annotations` returns a message saying the session has ended (the user closed the overlay).
5. When the session ends, stop looping and tell the user what you changed.

Do NOT run shell commands to get annotations. Use the MCP tool directly. Start now by calling `wait_for_annotations`.
