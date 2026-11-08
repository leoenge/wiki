**Add user info**
When signing up, we should let users add a "First name" as well. This is not a user name and does not have to be unique, but we will use it as the display name in most places of the app.

**Multi-user setup**
I want to make it possible to invite others to a page you have. 
- You should be able to add a user that is already on the platform by searching for email address
- You should be able to invite using a link

If you follow a link and you are already signed in your user gets added to the page. If you are not signed in, you get asked to sign in or sign up. When you have signed in or up, that account gets added to the page and you can see it in you list. Invite links are only valid for 72 hours.

When two users edit a page at the same time, both of them gets their own draft that they can edit. When you want to publish your draft, you'll get a warning if the page has been updated by someone else while you were in edit mode. You can then choose to apply your changes or not. We then just take the full draft without any merging.

We should add a settings icon in the top right of the pages view, to the right of the edit button. If you open this settings button you get a dialog, in which you can change the name of the page, the tag of the page and then click share to open up the share settings. The share settings shoud be opened in the same dialog suing a nice transition between the views.

**Be able to migrate the database without resetting the database.**
Do we have a script for applying the migrations to the database, without runningg the reset on the database? I want to have this. I want to also setup a python script for running migrations of the current data into the new format, if this is needed. At this moment this will be empty, but we should add to the AGENTS.md that this script should be updated so that it can be used to move data to new format when need. For some data model updates we won't needed any explicit script becuase the data model change is easy, but sometimes this will be needed.

**Reviews**
I want to add the concept of reviews. We should have this in two ways:
- You should be able to add a review on every item that is added to a map.
- You should be able to add a specific reviews element.

Reviews are a 0-5 star review system, with a single comment. You can assign half stars as well, so in practice we have 10 steps. The idea is that everyone that is on a page can add a review to reviewable stuff and we then show a breakdown of the reviews.

On maps:
On the list of items that are added to a map, we should show a star row which you can click to add your review. If there are other reviews, we show the name of each reviewer and their review. We then also show a average score on each item.

On review elements:
This is a custom list you add where you type and item name and add it and then this becomes a list, a bit like the list of items connected to a map. Each of these has a review system like the maps items above.

When adding your review there should also be a little input field for a short commment connected to your review.

**Comments**
You should be able to comment every element that is on the page. So images, text elements, a map, a review card etc. You should be able to comment the top-level element, not items in the element. So you comment the whole map element, not the individual items. We should show a comment icon in connection to the element, and when you click that we open up a new view, where we show only the selected element at the top, and then a listing of the comments below, and an input field for you to write comments.

**Lists**
This is a bit like a text element, but it is just a list of items. You chose whether it is a bullet list or a numbered list. You then enter item by item, a bit like when you add stuff to a map right now.