# Shared game rules and starter vocabulary

`game.ts` has no UI, network, browser, storage, or clock dependency. The same
validation and scoring functions can run in a web client, mobile wrapper, or
authoritative multiplayer server. `chooseLetter` uses its runtime's random
source; the daily letter and practice opponent are deterministic from explicit
inputs.

## Dictionary scope

The included answer pack is an original, manually assembled list of common
Persian names, surnames, world cities, foods, fruits, and animals. It contains no
scraped dictionary, encyclopedia passages, or third-party database. It is part
of this repository and uses the repository's MIT license. The word facts and
familiar proper names are not claims of an exhaustive or authoritative lexicon.

Fourteen starter letters were chosen because each supports all six categories.
The pack includes a few familiar food and fruit loanwords, spelling variants,
and foreign cities. Names must start with the selected letter, including the
whole written name; a prefix is not silently discarded. آ، أ، إ، and ا are
equivalent for this game's starting-letter rule. A small explicit list also
groups spelling variants of the same word, such as خورش / خورشت and منگو /
مانگو, so those variants share duplicate points. The engine does not guess at
semantic synonyms or stem words.

This pack is intentionally finite. Unknown Persian text with a matching first
letter requires an explicit human decision. Unknown words are never treated as
automatically wrong or automatically awarded points. A dictionary match can
also be rejected through the domain API's explicit override mechanism. The
current UI offers review controls for unfamiliar answers; online review uses a
majority of the other participants, with no self-vote. Blank, malformed, and
wrong-letter text remain invalid. The online server owns all review decisions
and scoring; a client-supplied score or override is not authoritative.

## Scoring contract

- Accepted answer appearing once in its category: 10 points.
- Accepted answer shared by multiple players in that category: 5 points each.
- Blank, invalid, or unresolved answer: 0 points.
- Rejected answers do not reduce another player's unique score.
- Comparisons ignore Arabic/Persian yeh and kaf variants, alef variants,
  vowel marks, tatweel, whitespace, half-spaces, and invisible bidi controls.
- Explicit category-scoped spelling aliases count as the same answer.
- Display spelling is preserved, and entries are never modified by scoring.

Review keys use `${playerId}:${category}`. Review is an explicit decision about
a particular cell, not a permanent edit to the dictionary. A future room may
offer agreed house rules, but the first playable build uses one visible scoring
rule so that every player can understand the result.

`getPracticeRival` represents a computer, never a real online player. It picks
five known answers and misses one category. Its answers are stable for a seed
and do not inspect the human player's answers.
