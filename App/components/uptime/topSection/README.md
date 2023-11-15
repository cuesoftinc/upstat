This component serves as a reusable top section that can be employed across all system subsections of Uptime. It offers flexibility by accepting two props, namely system and back.

system: This prop is designed to receive a string that specifies the name of the system in which the component is intended to be used. The possible values for this prop include "api," "website," and "server," for now.

back: The back prop is crucial for indicating whether the component is a subsection of uptime and requires the ability to navigate back to the previous route. To enable this functionality, set the back prop to "true" for any given subsection.

