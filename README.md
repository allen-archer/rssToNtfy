# rssToNtfy - Turning RSS feeds into push notifications via ntfy.sh

## Purpose of this project

I wanted a way to get push notifications for RSS feeds with some customization. The notifications will have a title and body. Clicking or tapping the notification body will open the link provided by the RSS feed.

## How to use this project

Create a config.yml file in a directory somewhere on your host machine. The contents of that file will determine what RSS feeds get polled and how the notifications will work.

``run -d -v /path/to/your/config/directory:/rsstontfy/config --name=rsstontfy ghcr.io/chunkystyles/rsstontfy:latest``

## config.yml
    
```
  # 1-5, or ignore, overridden by category priority
defaultPriority: 1
  # any cron expression will work here, overridden by feed cronExpression
defaultCronExpression: '*/5 * * * *'
ntfy:
    # the URL of the ntfy.sh instance you want to use
  url: 'https://ntfy.sh/'
    # OPTIONAL, the user and password to authenticate with ntfy.sh
    # both must be set for basic authentication
  user: 'yourname'  
  password: 'yourpassword'
    # OPTIONAL, the token to authenticate with ntfy.sh
    # if user and password are set, this is ignored
  token: 'tk_AgQdq7mVBoFD37zQVN29RhuMzNIz2'
  # a list of feeds to poll, use as few or as many as you want, each is completely independent
feeds:
      # a unique name for this feed
  - name: news
      # the topic to post to ntfy.sh
    topic: news
      # a list of URLs to poll, if you use multiple, the results will be combined
    urls:
      - 'https://time.com/feed/'
      - 'https://openrss.org/www.reuters.com/world/'
       # OPTIONAL, any cron expression will work here, overrides defaultCronExpression
    cronExpression: '*/10 * * * *'
      # OPTIONAL, a list of tags (emojis) for this feed, categories tags will combine with these
    tags:
      - memo
        # OPTIONAL, the priority to use for this feed, overrides defaultPriority
    priority: 2
      # OPTIONAL, a list of replacements to make in the feed, useful for cleaning up the feed
      # NOTE: yaml requires double quotes for character escapes to be interpreted correctly
    replacements:
      - from: '<br>'
        to: "\n"
      - from: ';'
        to: "\n"
      # OPTIONAL, whether or not to trim whitespace between newlines
    trim: true
      # OPTIONAL, a list of categories to tweak the priority and tags of the feed when either the title or content of an item matches
      # These are processed from top to bottom, and the first one that matches is the one that is used
      # If no categories match, the defaultPriority and defaultTags are used
    categories:
          # OPTIONAL, matches on the contents of the item, either through lines of text, or a regex expression
      - contents:
            #OPTIONAL, if any of these lines of text are found in the contentes of the item, this category is used
          text:
            - 'movie'
            - 'theater'
            # OPTIONAL, if this regex is found in the contents of the item, this category is used
          regex: '\d STARS'
          # OPTIONAL, if any of these words are found in the title of the item, this category is used 
        title:
            #OPTIONAL, if any of these lines of text are found in the title of the item, this category is used
          text:
            - 'movie'
            - 'theater'
            # OPTIONAL, if this regex is found in the title of the item, this category is used
          regex: '\d STARS'
          # OPTIONAL, additional tags to add to the tags list
        tags:
          - film_strip
          - popcorn
          # OPTIONAL, the priority to use for this category, overrides the feed priority and defaultPriority
        priority: 3
```

### priority

Documentation for priority can be found at https://docs.ntfy.sh/publish/#message-priority Setting the priority to 'ignore' is specific to this app and is used to filter out undesired notifications. Setting priority to 'super_ignore' will prevent the notification from being sent even if it matches with other categories.

### tags

Documentation for tags can be found at https://docs.ntfy.sh/emojis/
