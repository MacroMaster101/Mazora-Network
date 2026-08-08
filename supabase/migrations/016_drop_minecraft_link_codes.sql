-- Removes the Minecraft account-linking verification mechanism.
--
-- The website never shipped verified Minecraft linking: the plugin endpoint
-- that consumed these codes was permanently disabled, and the only UI that
-- issued them recorded a self-declared username it could not prove. All of that
-- application code has been deleted, so the codes table and the RPC that
-- consumed it are now unreachable.
--
-- public.minecraft_accounts is deliberately NOT dropped: it still backs the
-- players directory, leaderboards and the Minecraft skin avatar.
--
-- This table only ever held short-lived (10 minute) verification codes, so
-- there is no durable user data to preserve.

-- The RPC reads and writes minecraft_link_codes, so it must go first.
drop function if exists public.consume_minecraft_link_code(text, uuid, text);

-- Policies and indexes are dropped implicitly along with the table.
drop table if exists public.minecraft_link_codes;
