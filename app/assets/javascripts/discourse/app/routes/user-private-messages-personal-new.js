import createPMRoute from "discourse/routes/build-private-messages-route";

export default createPMRoute(
  "personal",
  "private-messages-new",
  null /* no message bus notifications */
);
