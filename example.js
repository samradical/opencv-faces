const { GetFacesFromClip } = require('./index')
GetFacesFromClip(
  'data/fake2.mkv', {
    doBackgrounds: false,
    removeOriginalVideo: false,
    dissimilartyFudge:.3, //decide how to group frames
    minSecondsBetweenScenes: 1, //merge scenes if they are but x seconds apart
    fps: 0.05, //half the fps,
    outputDir: "output_frames",
    outputImageHeight: "480",
    imageExt: "png",
    lookbackSecs: 1
  }
).then(r => {
  console.log(r);
})
