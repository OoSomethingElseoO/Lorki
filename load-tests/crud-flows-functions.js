// Unique, clearly-tagged data per virtual user — "loadtest-" prefix on
// every name/email so these rows are easy to find and remove from
// /admin afterward (this test run doesn't clean up after itself).
function tag() {
  return `loadtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function setArtistVars(context, events, done) {
  const t = tag();
  context.vars.email = `${t}@example.com`;
  context.vars.password = "LoadTest-Password-1";
  context.vars.artistName = `Load Test Artist ${t}`;
  context.vars.artworkTitle = `Load Test Artwork ${t}`;
  return done();
}

function setCauseVars(context, events, done) {
  const t = tag();
  context.vars.email = `${t}@example.com`;
  context.vars.password = "LoadTest-Password-1";
  context.vars.causeContactName = `Load Test Rep ${t}`;
  context.vars.causeName = `Load Test Cause ${t}`;
  context.vars.registrationNumber = `LOADTEST-${t}`;
  return done();
}

module.exports = { setArtistVars, setCauseVars };
