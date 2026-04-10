Annotate UI elements in a running app and return structured design feedback.

The user wants you to look at their running app and make design changes based on their annotations.
This command waits for the user to submit annotations from the Promptotype browser extension, then returns them.

`!curl -sN http://localhost:4100/__pt__/api/wait`

The output above contains structured design annotations with CSS selectors, current computed styles, and user prompts for each annotated element. Use these annotations to make the requested changes to the codebase.
