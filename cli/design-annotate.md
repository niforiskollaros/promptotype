Annotate UI elements in a running app and return structured design feedback.

The user wants you to look at their running app and make design changes based on their annotations.
Run the design-annotator proxy to let them select elements, describe what they want changed, and submit structured feedback.

`!~/.local/bin/design-annotator $ARGUMENTS`

The output above contains structured design annotations with CSS selectors, current computed styles, and user prompts for each annotated element. Use these annotations to make the requested changes to the codebase.
