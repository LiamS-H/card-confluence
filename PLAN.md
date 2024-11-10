### Client URL state.
Imagine your phone defaults to soething like release because you are often looking things up playing unfamiliar cards at game store. But your computer defaults to cmc because you often look up cards for deck building.



# MVP
## Landing Page
 [ ] Standard product landing page explain the features we have over scryfall
 [ ] Cards flying 3d with scroll

## Search page
 [ ] Make search adjust columns dynaimaclly to screensize
 [W] Add buttons for search order
 [ ] add import scryfall query
 [ ] add tagger to catalog for autocomplete
 [ ] add toggle for snap scrolling
 [ ] use scryfall errors to flag invalid tags
    [ ] parse the scryfall warning returned string for the culprit tags and then search the tree for said tags.
    [ ] have a simple  ``` Set<string>``` of bad args that is then checked when rendering the tags
 [ ] distinguish better between adding filter or group
 [ ] setting defaul behavior and storing blocks on your computer, can also make account if wanted
 [ ] add click to esp list and arrow keys
 [W] when a non order part changes make a call to make the scroll appear with the same cards in the center of the screen, can a play an animation
 [W] use easy animation library to make the cards move when filters change , try swapy, or react auto animate
 [W] youtube transparent scroll bar copy

## Maybe waste time on but later
 [ ] Move to tanstack router so that state can be stored in url
 [ ] add triggers
 [ ] add dnd
 [ ] add light mode

## AI Shit
 [ ] Train a model for better tagging (could just use roberta)
 [ ] Use an llm api for construction queries 