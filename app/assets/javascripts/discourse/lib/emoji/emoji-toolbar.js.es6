// note that these categories are copied from Slack
// be careful, there are ~20 differences in synonyms, e.g. :boom: vs. :collision:
// a few Emoji are actually missing from the Slack categories as well (?), and were added
var groups = [
  {
    name: "people",
    fullname: "People",
    tabicon: "grinning",
    icons: ["grinning", "grin", "joy", "smiley", "smile", "sweat_smile", "laughing", "innocent", "smiling_imp", "imp", "wink", "blush", "relaxed", "yum", "relieved", "heart_eyes", "sunglasses", "smirk", "neutral_face", "expressionless", "unamused", "sweat", "pensive", "confused", "confounded", "kissing", "kissing_heart", "kissing_smiling_eyes", "kissing_closed_eyes", "stuck_out_tongue", "stuck_out_tongue_winking_eye", "stuck_out_tongue_closed_eyes", "disappointed", "worried", "angry", "rage", "cry", "persevere", "triumph", "disappointed_relieved", "frowning", "anguished", "fearful", "weary", "sleepy", "tired_face", "grimacing", "sob", "open_mouth", "hushed", "cold_sweat", "scream", "astonished", "flushed", "sleeping", "dizzy_face", "no_mouth", "mask", "smile_cat", "joy_cat", "smiley_cat", "heart_eyes_cat", "smirk_cat", "kissing_cat", "pouting_cat", "crying_cat_face", "scream_cat", "footprints", "bust_in_silhouette", "busts_in_silhouette", "baby", "boy", "girl", "man", "woman", "family", "couple", "two_men_holding_hands", "two_women_holding_hands", "dancers", "bride_with_veil", "person_with_blond_hair", "man_with_gua_pi_mao", "man_with_turban", "older_man", "older_woman", "cop", "construction_worker", "princess", "guardsman", "angel", "santa", "ghost", "japanese_ogre", "japanese_goblin", "hankey", "skull", "alien", "space_invader", "bow", "information_desk_person", "no_good", "ok_woman", "raising_hand", "person_with_pouting_face", "person_frowning", "massage", "haircut", "couple_with_heart", "couplekiss", "raised_hands", "clap", "hand", "ear", "eyes", "nose", "lips", "kiss", "tongue", "nail_care", "wave", "+1", "-1", "point_up", "point_up_2", "point_down", "point_left", "point_right", "ok_hand", "v", "facepunch", "fist", "raised_hand", "muscle", "open_hands", "pray"]
  },
  {
    name: "nature",
    fullname: "Nature",
    tabicon: "leaves",
    icons: ["seedling", "evergreen_tree", "deciduous_tree", "palm_tree", "cactus", "tulip", "cherry_blossom", "rose", "hibiscus", "sunflower", "blossom", "bouquet", "ear_of_rice", "herb", "four_leaf_clover", "maple_leaf", "fallen_leaf", "leaves", "mushroom", "chestnut", "rat", "mouse2", "mouse", "hamster", "ox", "water_buffalo", "cow2", "cow", "tiger2", "leopard", "tiger", "rabbit2", "rabbit", "cat2", "cat", "racehorse", "horse", "ram", "sheep", "goat", "rooster", "chicken", "baby_chick", "hatching_chick", "hatched_chick", "bird", "penguin", "elephant", "dromedary_camel", "camel", "boar", "pig2", "pig", "pig_nose", "dog2", "poodle", "dog", "wolf", "bear", "koala", "panda_face", "monkey_face", "see_no_evil", "hear_no_evil", "speak_no_evil", "monkey", "dragon", "dragon_face", "crocodile", "snake", "turtle", "frog", "whale2", "whale", "dolphin", "octopus", "fish", "tropical_fish", "blowfish", "shell", "snail", "bug", "ant", "bee", "beetle", "feet", "zap", "fire", "crescent_moon", "sunny", "partly_sunny", "cloud", "droplet", "sweat_drops", "umbrella", "dash", "snowflake", "star2", "star", "stars", "sunrise_over_mountains", "sunrise", "rainbow", "ocean", "volcano", "milky_way", "mount_fuji", "japan", "globe_with_meridians", "earth_africa", "earth_americas", "earth_asia", "new_moon", "waxing_crescent_moon", "first_quarter_moon", "moon", "full_moon", "waning_gibbous_moon", "last_quarter_moon", "waning_crescent_moon", "new_moon_with_face", "full_moon_with_face", "first_quarter_moon_with_face", "last_quarter_moon_with_face", "sun_with_face"]
  },
  {
    name: "food",
    fullname: "Food & Drink",
    tabicon: "hamburger",
    icons: ["tomato", "eggplant", "corn", "sweet_potato", "grapes", "melon", "watermelon", "tangerine", "lemon", "banana", "pineapple", "apple", "green_apple", "pear", "peach", "cherries", "strawberry", "hamburger", "pizza", "meat_on_bone", "poultry_leg", "rice_cracker", "rice_ball", "rice", "curry", "ramen", "spaghetti", "bread", "fries", "dango", "oden", "sushi", "fried_shrimp", "fish_cake", "icecream", "shaved_ice", "ice_cream", "doughnut", "cookie", "chocolate_bar", "candy", "lollipop", "custard", "honey_pot", "cake", "bento", "stew", "egg", "fork_and_knife", "tea", "coffee", "sake", "wine_glass", "cocktail", "tropical_drink", "beer", "beers", "baby_bottle"]
  },
  {
    name: "celebration",
    fullname: "Celebration",
    tabicon: "gift",
    icons: ["ribbon", "gift", "birthday", "jack_o_lantern", "christmas_tree", "tanabata_tree", "bamboo", "rice_scene", "fireworks", "sparkler", "tada", "confetti_ball", "balloon", "dizzy", "sparkles", "boom", "mortar_board", "crown", "dolls", "flags", "wind_chime", "crossed_flags", "izakaya_lantern", "ring", "heart", "broken_heart", "love_letter", "two_hearts", "revolving_hearts", "heartbeat", "heartpulse", "sparkling_heart", "cupid", "gift_heart", "heart_decoration", "purple_heart", "yellow_heart", "green_heart", "blue_heart"]
  },
  {
    name: "activity",
    fullname: "Activities",
    tabicon: "soccer",
    icons: ["runner", "walking", "dancer", "rowboat", "swimmer", "surfer", "bath", "snowboarder", "ski", "snowman", "bicyclist", "mountain_bicyclist", "horse_racing", "tent", "fishing_pole_and_fish", "soccer", "basketball", "football", "baseball", "tennis", "rugby_football", "golf", "trophy", "running_shirt_with_sash", "checkered_flag", "musical_keyboard", "guitar", "violin", "saxophone", "trumpet", "musical_note", "notes", "musical_score", "headphones", "microphone", "performing_arts", "ticket", "tophat", "circus_tent", "clapper", "art", "dart", "8ball", "bowling", "slot_machine", "game_die", "video_game", "flower_playing_cards", "black_joker", "mahjong", "carousel_horse", "ferris_wheel", "roller_coaster"]
  },
  {
    name: "travel",
    fullname: "Travel & Places",
    tabicon: "airplane",
    icons: ["train", "mountain_railway", "railway_car", "steam_locomotive", "monorail", "bullettrain_side", "bullettrain_front", "train2", "metro", "light_rail", "station", "tram", "bus", "oncoming_bus", "trolleybus", "minibus", "ambulance", "fire_engine", "police_car", "oncoming_police_car", "rotating_light", "taxi", "oncoming_taxi", "car", "oncoming_automobile", "blue_car", "truck", "articulated_lorry", "tractor", "bike", "busstop", "fuelpump", "construction", "vertical_traffic_light", "traffic_light", "rocket", "helicopter", "airplane", "seat", "anchor", "ship", "speedboat", "boat", "aerial_tramway", "mountain_cableway", "suspension_railway", "passport_control", "customs", "baggage_claim", "left_luggage", "yen", "euro", "pound", "dollar", "statue_of_liberty", "moyai", "foggy", "tokyo_tower", "fountain", "european_castle", "japanese_castle", "city_sunrise", "city_sunset", "night_with_stars", "bridge_at_night", "house", "house_with_garden", "office", "department_store", "factory", "post_office", "european_post_office", "hospital", "bank", "hotel", "love_hotel", "wedding", "church", "convenience_store", "school", "cn", "de", "es", "fr", "gb", "it", "jp", "kr", "ru", "us"]
  },
  {
    name: "objects",
    fullname: "Objects & Symbols",
    tabicon: "eyeglasses",
    icons: ["watch", "iphone", "calling", "computer", "alarm_clock", "hourglass_flowing_sand", "hourglass", "camera", "video_camera", "movie_camera", "tv", "radio", "pager", "telephone_receiver", "phone", "fax", "minidisc", "floppy_disk", "cd", "dvd", "vhs", "battery", "electric_plug", "bulb", "flashlight", "satellite", "credit_card", "money_with_wings", "moneybag", "gem", "closed_umbrella", "pouch", "purse", "handbag", "briefcase", "school_satchel", "lipstick", "eyeglasses", "womans_hat", "sandal", "high_heel", "boot", "mans_shoe", "athletic_shoe", "bikini", "dress", "kimono", "womans_clothes", "shirt", "necktie", "jeans", "door", "shower", "bathtub", "toilet", "barber", "syringe", "pill", "microscope", "telescope", "crystal_ball", "wrench", "hocho", "nut_and_bolt", "hammer", "bomb", "smoking", "gun", "bookmark", "newspaper", "key", "email", "envelope_with_arrow", "incoming_envelope", "e-mail", "inbox_tray", "outbox_tray", "package", "postal_horn", "postbox", "mailbox_closed", "mailbox", "mailbox_with_mail", "mailbox_with_no_mail", "page_facing_up", "page_with_curl", "bookmark_tabs", "chart_with_upwards_trend", "chart_with_downwards_trend", "bar_chart", "date", "calendar", "low_brightness", "high_brightness", "scroll", "clipboard", "book", "notebook", "notebook_with_decorative_cover", "ledger", "closed_book", "green_book", "blue_book", "orange_book", "books", "card_index", "link", "paperclip", "pushpin", "scissors", "triangular_ruler", "round_pushpin", "straight_ruler", "triangular_flag_on_post", "file_folder", "open_file_folder", "black_nib", "pencil2", "memo", "lock_with_ink_pen", "closed_lock_with_key", "lock", "unlock", "mega", "loudspeaker", "sound", "loud_sound", "speaker", "mute", "zzz", "bell", "no_bell", "thought_balloon", "speech_balloon", "children_crossing", "mag", "mag_right", "no_entry_sign", "no_entry", "name_badge", "no_pedestrians", "do_not_litter", "no_bicycles", "non-potable_water", "no_mobile_phones", "underage", "accept", "ideograph_advantage", "white_flower", "secret", "congratulations", "u5408", "u6e80", "u7981", "u6709", "u7121", "u7533", "u55b6", "u6708", "u5272", "u7a7a", "sa", "koko", "u6307", "chart", "sparkle", "eight_spoked_asterisk", "negative_squared_cross_mark", "white_check_mark", "eight_pointed_black_star", "vibration_mode", "mobile_phone_off", "vs", "a", "b", "ab", "cl", "o2", "sos", "id", "parking", "wc", "cool", "free", "new", "ng", "ok", "up", "atm", "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpius", "sagittarius", "capricorn", "aquarius", "pisces", "restroom", "mens", "womens", "baby_symbol", "wheelchair", "potable_water", "no_smoking", "put_litter_in_its_place", "arrow_forward", "arrow_backward", "arrow_up_small", "arrow_down_small", "fast_forward", "rewind", "arrow_double_up", "arrow_double_down", "arrow_right", "arrow_left", "arrow_up", "arrow_down", "arrow_upper_right", "arrow_lower_right", "arrow_lower_left", "arrow_upper_left", "arrow_up_down", "left_right_arrow", "arrows_counterclockwise", "arrow_right_hook", "leftwards_arrow_with_hook", "arrow_heading_up", "arrow_heading_down", "twisted_rightwards_arrows", "repeat", "repeat_one", "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "keycap_ten", "1234", "hash", "abc", "abcd", "capital_abcd", "information_source", "signal_strength", "cinema", "symbols", "heavy_plus_sign", "heavy_minus_sign", "wavy_dash", "heavy_division_sign", "heavy_multiplication_x", "heavy_check_mark", "arrows_clockwise", "tm", "copyright", "registered", "currency_exchange", "heavy_dollar_sign", "curly_loop", "loop", "part_alternation_mark", "exclamation", "bangbang", "question", "grey_exclamation", "grey_question", "interrobang", "x", "o", "100", "end", "back", "on", "top", "soon", "cyclone", "m", "ophiuchus", "six_pointed_star", "beginner", "trident", "warning", "hotsprings", "recycle", "anger", "diamond_shape_with_a_dot_inside", "spades", "clubs", "hearts", "diamonds", "ballot_box_with_check", "white_circle", "black_circle", "radio_button", "red_circle", "large_blue_circle", "small_red_triangle", "small_red_triangle_down", "small_orange_diamond", "small_blue_diamond", "large_orange_diamond", "large_blue_diamond", "black_small_square", "white_small_square", "black_large_square", "white_large_square", "black_medium_square", "white_medium_square", "black_medium_small_square", "white_medium_small_square", "black_square_button", "white_square_button", "clock1", "clock2", "clock3", "clock4", "clock5", "clock6", "clock7", "clock8", "clock9", "clock10", "clock11", "clock12", "clock130", "clock230", "clock330", "clock430", "clock530", "clock630", "clock730", "clock830", "clock930", "clock1030", "clock1130", "clock1230"]
  }
];

// scrub groups
groups.forEach(function(group){
  group.icons = _.reject(group.icons, function(obj){
    return !Discourse.Emoji.exists(obj);
  });
});

// export so others can modify
Discourse.Emoji.groups = groups;

var closeSelector = function(){
  $('.emoji-modal, .emoji-modal-wrapper').remove();
  $('body, textarea').off('keydown.emoji');
};

var ungroupedIcons, recentlyUsedIcons;

var initializeUngroupedIcons = function(){
  ungroupedIcons = [];

  var groupedIcons = {};
  _.each(groups, function(group){
    _.each(group.icons, function(icon){
      groupedIcons[icon] = true;
    });
  });

  var emojis = Discourse.Emoji.list();
  _.each(emojis, function(emoji){
    if(groupedIcons[emoji] !== true){
      ungroupedIcons.push(emoji);
    }
  });

  if(ungroupedIcons.length > 0){
    groups.push({name: 'ungrouped', icons: ungroupedIcons});
  }
};

try {
  if (localStorage && !localStorage.emojiUsage) { localStorage.emojiUsage = "{}"; }
} catch(e){
/* localStorage can be disabled, or cookies disabled, do not crash script here
 * TODO introduce a global wrapper for dealing with local storage
 * */
}

var trackEmojiUsage = function(title){
  var recent = JSON.parse(localStorage.emojiUsage);

  if (!recent[title]) { recent[title] = { title: title, usage: 0 }; }
  recent[title]["usage"]++;

  localStorage.emojiUsage = JSON.stringify(recent);

  // clear the cache
  recentlyUsedIcons = null;
};

var initializeRecentlyUsedIcons = function(){
  recentlyUsedIcons = [];

  var usage = _.map(JSON.parse(localStorage.emojiUsage));
  usage.sort(function(a,b){
    if(a.usage > b.usage){
      return -1;
    }
    if(b.usage > a.usage){
      return 1;
    }
    return a.title.localeCompare(b.title);
  });

  var recent = _.take(usage, PER_ROW);

  if(recent.length > 0){
    _.each(recent, function(emoji){
      recentlyUsedIcons.push(emoji.title);
    });

    var recentGroup = _.find(groups, {name: 'recent'});
    if(!recentGroup){
      recentGroup = {name: 'recent', icons: []};
      groups.push(recentGroup);
    }

    recentGroup.icons = recentlyUsedIcons;
  }
};

var toolbar = function(selected){
  if (!ungroupedIcons) { initializeUngroupedIcons(); }
  if (!recentlyUsedIcons) { initializeRecentlyUsedIcons(); }

  return _.map(groups, function(g, i){
    var icon = g.name === "recent" ? "star2" : g.icons[0];
    var row = {src: Discourse.Emoji.urlFor(icon), groupId: i};
    if(i === selected){
      row.selected = true;
    }
    return row;
  });
};

var PER_ROW = 12, PER_PAGE = 60;

var bindEvents = function(page,offset){
  var composerController = Discourse.__container__.lookup('controller:composer');

  $('.emoji-page a').click(function(){
    var title = $(this).attr('title');
    trackEmojiUsage(title);
    composerController.appendTextAtCursor(":" + title + ":", {space: true});
    closeSelector();
    return false;
  }).hover(function(){
    var title = $(this).attr('title');
    var html = "<img src='" + Discourse.Emoji.urlFor(title) + "' class='emoji'> <span>:" + title + ":<span>";
    $('.emoji-modal .info').html(html);
  },function(){
    $('.emoji-modal .info').html("");
  });

  $('.emoji-modal .nav .next a').click(function(){
    render(page, offset+PER_PAGE);
  });

  $('.emoji-modal .nav .prev a').click(function(){
    render(page, offset-PER_PAGE);
  });

  $('.emoji-modal .toolbar a').click(function(){
    var page = parseInt($(this).data('group-id'));
    render(page,0);
    return false;
  });
};

var render = function(page, offset){
  localStorage.emojiPage = page;
  localStorage.emojiOffset = offset;

  var toolbarItems = toolbar(page);
  var rows = [], row = [];
  var icons = groups[page].icons;
  var max = offset + PER_PAGE;

  for(var i=offset; i<max; i++){
    if(!icons[i]){ break; }
    if(row.length === PER_ROW){
      rows.push(row);
      row = [];
    }
    row.push({src: Discourse.Emoji.urlFor(icons[i]), title: icons[i]});
  }
  rows.push(row);

  var model = {
    toolbarItems: toolbarItems,
    rows: rows,
    prevDisabled: offset === 0,
    nextDisabled: (max + 1) > icons.length
  };

  $('body .emoji-modal').remove();
  var rendered = Ember.TEMPLATES["emoji-toolbar.raw"](model);
  $('body').append(rendered);

  bindEvents(page, offset);
};

var showSelector = function(){
  $('body').append('<div class="emoji-modal-wrapper"></div>');

  $('.emoji-modal-wrapper').click(function(){
    closeSelector();
  });

  var page = parseInt(localStorage.emojiPage) || 0;
  var offset = parseInt(localStorage.emojiOffset) || 0;
  render(page, offset);

  $('body, textarea').on('keydown.emoji', function(e){
    if(e.which === 27){
      closeSelector();
      return false;
    }
  });
};

export { showSelector };
