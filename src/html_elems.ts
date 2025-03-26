/*
A list of HTML elements, the contents of which the two 'modes' (EmbeddingEditor and CliqueViewer)
clear out on load and fill with their own stuff. These are essentially the places it is 'safe' to
put new elements, as they will be cleared out on mode change.
*/
export const SIDEBAR_HEAD: HTMLDivElement   = document.getElementById("sb-head") as HTMLHeadingElement;
export const SIDEBAR_CONTENTS: HTMLDivElement   = document.getElementById("sb-contents") as HTMLDivElement;
export const RIGHT_AREA: HTMLDivElement = document.getElementById("right_area") as HTMLDivElement;