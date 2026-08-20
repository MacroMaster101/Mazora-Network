/*
  Links existing news articles to the account that published them.

  Why they were not linked already: every article on the site was imported from
  Discord, and the importer stores only a byline *snapshot* (author_name,
  author_role, author_avatar_url). It never recorded author_id. The read path
  prefers a live profile joined on author_id and only falls back to the
  snapshot, so with the id missing it had to match author_name against
  profiles.username instead — a lookup that breaks the moment someone renames.

  That is what happened here. The same Discord account published under three
  different bylines over time:

    ". ℓιℓуℓυνν"  — 26 articles, no matching profile username, so the byline
                     fell back to the raw Discord name and a monogram avatar
    "LilyLuvv"    —  1 article, the former name, same outcome
    "CutiePlums"  —  5 articles, the current name, which did resolve

  The three are provably one account, not an assumption: the "LilyLuvv" row and
  one "CutiePlums" row both carry discord_author = '. ℓιℓуℓυνν'.

  Setting author_id makes the byline self-updating from here on — name, avatar
  and role all follow the account, and any future rename costs nothing.
  src/lib/actions/news.ts now stores author_id at publish time so no new row
  arrives in this state.

  The account is resolved by username rather than hardcoded so this reads as
  intent instead of a magic UUID. Scoped to author-mode rows that are still
  unlinked and whose byline is one of the three known spellings; anything else
  is left untouched.
*/

begin;

update public.news_articles as a
set author_id = p.user_id
from public.profiles as p
where p.username = 'CutiePlums'
  and a.author_id is null
  and a.publisher_mode = 'author'
  and (
    a.author_name in ('CutiePlums', 'LilyLuvv', '. ℓιℓуℓυνν')
    or a.discord_author in ('CutiePlums', '. ℓιℓуℓυνν')
  );

commit;
