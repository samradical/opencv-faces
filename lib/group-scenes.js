const Q = require('bluebird')
const cv = require('opencv')
const path = require('path')
const exec = require('child_process').exec
const spawn = require('child_process').spawnSync
const readDir = require('readdir');
const colors = require('colors');
const _ = require('lodash');

const compare = (img1, img2) => {
  return new Q((yes, no) => {

    console.log(colors.green(`Comparing frames ${img1} && \n ${img2}`));

    if(!img2){
      console.log(colors.yellow(`${img2} NOT FOUND`));
      return yes(100)
    }

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
const CompareFrames = (videoFramesFaces, options) => {
  return new Q((yes, no) => {
    Q.map(videoFramesFaces, (frameObject, i) => {
        const next = videoFramesFaces[i + 1] || videoFramesFaces[i - 1] || {}
        return compare(frameObject.imagePath, next.imagePath)
      }, { concurrency: 1 })
      .then(dissimilarities => {
        let arr = [];

        let scenes = []

        /*
        scenes: [
          [],
          []
        ]

        */

        dissimilarities.forEach((dissimilarity, i) => {
          //frame is different to the next, put the new one in arr
          if (dissimilarities[i - 1] > options.dissimilartyFudge * 100) {

            if (arr.length) {
              //insert array into scenes
              scenes.push(_.flatten([...arr]))
              //make new scenes
              arr = []
              console.log(colors.green(`${dissimilarity} New scene at ${videoFramesFaces[i].imagePath}`));
            }
          }
          //add to array
          arr.push(videoFramesFaces[i])

          if (i === dissimilarities.length - 1 && arr.length) {
            scenes.push(_.flatten([...arr]))
          }
        })

        arr = []
        const newScenes = []
        let active = []
        let i = 0
        while (i < scenes.length) {
          const scene = scenes[i]
          const next = scenes[i + 1]
          if (!next) {
            if(active.length){
              newScenes.push(_.flatten([...active]))
            }
            newScenes.push(scene)
            i++
          } else {
            active = active || []
            const { startTime } = next[0]
            const { endTime } = scene[i]
            if (endTime - startTime < options.minSecondsBetweenScenes) {
              active.push(_.flatten([...scene, ...next]))
              i++
            } else {
              newScenes.push(_.flatten([...active]))
              newScenes.push(scene)
              active = []
              i++
            }
          }
        }

        yes(newScenes)
      })
  })
}

module.exports = CompareFrames
