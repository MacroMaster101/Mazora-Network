import assert from "node:assert/strict";
import test from "node:test";
import { withLikeRestored, withLikeToggled } from "@/lib/gallery-likes";

interface Art {
  id: string;
  title: string;
  hasLiked?: boolean;
  likesCount: number;
}

const art = (id: string, hasLiked: boolean | undefined, likesCount: number): Art => ({
  id,
  title: `art ${id}`,
  hasLiked,
  likesCount,
});

test("liking an artwork marks it and raises the count", () => {
  const [item] = withLikeToggled([art("a", false, 2)], "a");
  assert.equal(item.hasLiked, true);
  assert.equal(item.likesCount, 3);
});

test("unliking an artwork clears it and lowers the count", () => {
  const [item] = withLikeToggled([art("a", true, 3)], "a");
  assert.equal(item.hasLiked, false);
  assert.equal(item.likesCount, 2);
});

test("the count never goes negative", () => {
  // The server clamps with GREATEST(count - 1, 0); the optimistic view has to
  // agree or the two briefly disagree by one and the number jumps on refresh.
  const [item] = withLikeToggled([art("a", true, 0)], "a");
  assert.equal(item.likesCount, 0);
});

test("only the artwork clicked is touched", () => {
  const [first, second] = withLikeToggled([art("a", false, 1), art("b", false, 5)], "a");
  assert.equal(first.likesCount, 2);
  assert.equal(second.likesCount, 5);
  assert.equal(second.hasLiked, false);
});

test("fields other than the like state survive a toggle", () => {
  const [item] = withLikeToggled([art("a", false, 1)], "a");
  assert.equal(item.title, "art a");
});

test("restoring puts back exactly what was there before the click", () => {
  // The guest case: the click flips the heart optimistically, the server
  // refuses, and the heart has to go back to how the viewer found it. Leaving
  // it filled tells them a like was recorded when none was.
  const before = art("a", false, 2);
  const optimistic = withLikeToggled([before], "a");
  assert.equal(optimistic[0].hasLiked, true);

  const [restored] = withLikeRestored(optimistic, "a", before);
  assert.equal(restored.hasLiked, false);
  assert.equal(restored.likesCount, 2);
});

test("restoring one artwork leaves other optimistic likes alone", () => {
  // The old rollback reset the whole list to the server snapshot, so one
  // rejected like silently undid every other like made since the page loaded.
  const before = art("a", false, 2);
  let items: Art[] = [before, art("b", false, 5)];
  items = withLikeToggled(items, "a");
  items = withLikeToggled(items, "b");

  const [a, b] = withLikeRestored(items, "a", before);
  assert.equal(a.hasLiked, false);
  assert.equal(a.likesCount, 2);
  assert.equal(b.hasLiked, true, "the unrelated like must survive");
  assert.equal(b.likesCount, 6);
});

test("restoring an id that is not present changes nothing", () => {
  const items = [art("a", true, 3)];
  assert.deepEqual(withLikeRestored(items, "missing", art("x", false, 0)), items);
});

test("an artwork the server sent without a like flag still toggles cleanly", () => {
  // hasLiked is optional on GalleryImage: a signed-out render omits it. It has
  // to become a definite boolean on click, and go back to absent on rollback,
  // rather than becoming a hard `false` the server never said.
  const before = art("a", undefined, 4);
  const [optimistic] = withLikeToggled([before], "a");
  assert.equal(optimistic.hasLiked, true);
  assert.equal(optimistic.likesCount, 5);

  const [restored] = withLikeRestored([optimistic], "a", before);
  assert.equal(restored.hasLiked, undefined);
  assert.equal(restored.likesCount, 4);
});
