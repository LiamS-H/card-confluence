### Client URL state.
Imagine your phone defaults to soething like release because you are often looking things up playing unfamiliar cards at game store. But your computer defaults to cmc because you often look up cards for deck building.



# MVP
## Landing Page
 [W] Standard product landing page explain the features we have over scryfall
 [ ] Cards flying 3d with scroll

## Search page
 [X] Make search adjust columns dynaimaclly to screensize
 [X] Add buttons for search order
 [ ] add importing of scryfall queries
 [ ] add tagger (atag and otag) to catalog for autocomplete
 [ ] // add toggle for snap scrolling
 [X] use scryfall errors to flag invalid tags
    [X] parse the scryfall warning returned string for the culprit tags and then search the tree for said tags.
 [ ] distinguish better between adding filter or group
 [ ] setting default behavior and storing blocks on your computer, can also make account if wanted
 [W] add click to esp list and arrow keys,
 [X] add full result to exp list by cropping based on index
 [ ] dedupe infinite scroll requests
 [ ] edit filters - default behavior deletes the value while keeping the tag and setting the curso at the tag. clicking off returns the original value if unedited.

# Maybe waste time on but later
 [ ] Move to tanstack router so that state can be stored in url
 [ ] add triggers
 [ ] add dnd
 [X] add light mode
 [ ] editing text in time and then using graph isomophism from the generated and edited graphs to try and piece them together (this would preserve the state of named components.)
## AI Shit
 [ ] Train a model for better tagging (could just use roberta)
 [ ] Use an llm api for construction queries 
## Optimisic Client Side Updates
 [ ] when a non order part changes make a call to make the scroll appear with the same cards in the center of the screen, can a play an animation
 [ ] use easy animation library to make the cards move when filters change , try swapy, or react auto animate

