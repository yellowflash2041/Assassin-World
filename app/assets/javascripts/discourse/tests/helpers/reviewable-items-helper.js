import { getRenderDirector } from "discourse/lib/reviewable-item";
import sessionFixtures from "discourse/tests/fixtures/session-fixtures";
import User from "discourse/models/user";
import Site from "discourse/models/site";

export function createRenderDirector(reviewable, reviewableType, siteSettings) {
  const director = getRenderDirector(
    reviewableType,
    reviewable,
    User.create(sessionFixtures["/session/current.json"].current_user),
    siteSettings,
    Site.current()
  );
  return director;
}
