### Client URL state.
Imagine your phone defaults to soething like release because you are often looking things up playing unfamiliar cards at game store. But your computer defaults to cmc because you often look up cards for deck building.



# MVP
## Landing Page
 [X] Standard product landing page explain the features we have over scryfall
 [X] Cards scrolling by

## Search page
 [X] Make search adjust columns dynaimaclly to screensize
 [X] Add buttons for search order
 [ ] add importing of scryfall queries
 [ ] add tagger (atag and otag) to catalog for autocomplete
 [X] use scryfall errors to flag invalid tags
    [X] parse the scryfall warning returned string for the culprit tags and then search the tree for said tags.
 [X] distinguish better between adding filter or group
 [ ] setting default behavior and storing blocks on your computer, can also make account if wanted
 [W] add click to esp list and arrow keys,
 [X] add full result to exp list by cropping based on index
 [ ] dedupe infinite scroll requests - map the query pages to the actual pages in a map, then you can check if mapped page is loading
 [ ] edit filters - default behavior deletes the value while keeping the tag and setting the curso at the tag. clicking off returns the original value if unedited.
 [ ] add copy paste to the query

## Docs page
 [X] add docs or link to syntax

# Maybe waste time on but later
 [ ] make autocomplete update with global filters ie:setting to premodern removes some of the creature types
 [ ] Move to tanstack router so that state can be stored in url
 [ ] add triggers
 [ ] add dnd
 [X] add light mode
 [ ] editing text in time and then using graph isomophism from the generated and edited graphs to try and piece them together (this would preserve the state of named components.)
 [ ] add scroll jumping to infinite scroll
## AI Shit
 [ ] Train a model for better tagging (could just use roberta)
 [ ] Use an llm api for construction queries 
## Optimisic Client Side Updates
 [ ] when a non order part changes make a call to make the scroll appear with the same cards in the center of the screen, can a play an animation
 [ ] use easy animation library to make the cards move when filters change, try swapy, or react auto animate

