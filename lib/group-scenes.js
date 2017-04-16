const Q = require('bluebird')
const cv = require('opencv')
const path = require('path')
const exec = require('child_process').exec
const spawn = require('child_process').spawnSync
const readDir = require('readdir');
const colors = require('colors');
const _ = require('lodash');

const DISS_FUDGE = 40

const compare = (img1, img2) => {
  return new Q((yes, no) => {

    console.log(colors.yellow(`Comparing frames ${img1} && \n ${img2}`));

    cv.readImage(img1, function(err, car1) {
      if (err) return no(err);
      cv.readImage(img2, function(err, car2) {
        if (err) return no(err);
        cv.ImageSimilarity(car1, car2, function(err, dissimilarity) {
          if (err) return no(err);
          console.log(colors.green(`${dissimilarity} similar`));
          yes(dissimilarity)
        });
      });
    });
  });
}

/*
How similar is a frame to the next
*/
const CompareFrames = (videoFramesFaces) => {
  return new Q((yes, no) => {
    Q.map(videoFramesFaces, (frameObject, i) => {
        const next = videoFramesFaces[i + 1] || videoFramesFaces[i - 1]
        return compare(frameObject.imagePath, next.imagePath)
      }, { concurrency: 1 })
      .then(dissimilarities => {
        let arr = [];

        const scenes = []

        dissimilarities.forEach((dissimilarity, i) => {
          //frame is different to the next, put the new one in arr
          if (dissimilarities[i - 1] > DISS_FUDGE) {

            if (arr.length) {
              scenes.push([...arr])
              arr = []
              //console.log(colors.green(`${dissimilarity} New scene at ${videoFramesFaces[i].imagePath}`));
            }
          }

          arr.push(videoFramesFaces[i])
        })

        yes(scenes)
      })
  })
}

module.exports = CompareFrames
