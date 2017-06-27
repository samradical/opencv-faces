const Q = require('bluebird')
const cv = require('opencv')
const path = require('path')
const fs = require('fs')
const exec = require('child_process').exec
const spawn = require('child_process').spawnSync
const readDir = require('readdir');
const colors = require('colors');
const _ = require('lodash');


const DEFAULT_OPTIONS = {
  fps: 0.05, //half the fps,
  outputDir: "output_frames",
  outputImageHeight: "480",
  imageExt: "png",
  lookbackSecs: 1
}

const faceDetectImage = (imagePath) => {
  return new Q((yes, no) => {
    cv.readImage(imagePath, function(err, im) {
      if (err) return yes(null);
      if (im.width() < 1 || im.height() < 1) return yes(null);

      console.log(colors.yellow(`Face detect on ${imagePath}`));

      im.detectObject(cv.FACE_CASCADE, {}, function(err, faces) {
        if (err) return yes(null);
        if (!faces.length) return yes(null);
        console.log(colors.green(`${faces.length} faces on ${imagePath}`));
        yes(faces)
      });
    });
  });
}

const getVideoFps = (videoPath) => {
  const child = spawn(`ffprobe`, [`-print_format`, `json`, `-show_format`, `-show_streams`, `-count_frames`, `${videoPath}`])
  const stdout = child.stdout.toString('utf-8');
  return Math.round(eval(JSON.parse(stdout).streams[0].r_frame_rate))
}

const getVideoDuration = (videoPath) => {
  const child = spawn(`ffprobe`, [`-print_format`, `json`, `-show_format`, `-show_streams`, `-count_frames`, `${videoPath}`])
  const stdout = JSON.parse(child.stdout.toString('utf-8'));
  let d = Math.round(parseInt(stdout.streams[0].duration), 10)
  if(!d || isNaN(d)){
    d = Math.floor(stdout.format.duration)
  }
  return  d
}

const getVideoTotalFrames = (videoPath) => {
  const child = spawn(`ffprobe`, [`-print_format`, `json`, `-show_format`, `-show_streams`, `-count_frames`, `${videoPath}`])
  const stdout = child.stdout.toString('utf-8');
  return Math.round(parseInt(JSON.parse(stdout).streams[0].nb_read_frames), 10)
}

const ExtractFrames = (videoPath, options = {}) => {
  return new Q((yes, no) => {
    options = Object.assign({}, DEFAULT_OPTIONS, options)
    const { fps, outputDir, imageExt, outputImageHeight } = options
    const { base } = path.parse(videoPath)

    const videoFps = getVideoFps(videoPath)
    console.log(colors.yellow(`spawned command ffmpeg on ${videoPath}`));

    const child = spawn(`ffmpeg`, [`-i`, `${videoPath}`, `-r`, `${videoFps*fps}/1`, `-vf`, `scale=-1:${outputImageHeight}`, `-y`, `${outputDir}/${base}%03d.${imageExt}`])
    const stderr = child.stderr.toString('utf-8');
    const stdout = child.stdout.toString('utf-8');

    yes(readDir.readSync(outputDir, [`**.${imageExt}`], readDir.ABSOLUTE_PATHS));
  })
}

const FaceFromClip = (videoPath, options = {}) => {
  return new Q((yes, no) => {


    options = Object.assign({}, DEFAULT_OPTIONS, options)
    const { fps, outputDir, imageExt, outputImageHeight } = options
    const { base } = path.parse(videoPath)

    const child = spawn(`rm`, [`-rf`, `${outputDir}`])
    fs.mkdirSync(outputDir)

    const videoFps = options.videoFps || getVideoFps(videoPath)
    const videoTotalFrames = getVideoTotalFrames(videoPath)
    const videoDuration = getVideoDuration(videoPath)

    console.log(colors.blue(`-----------`));
    console.log(colors.green(`videoFps: ${videoFps}`));
    console.log(colors.green(`videoTotalFrames: ${videoTotalFrames}`));
    console.log(colors.green(`videoDuration: ${videoDuration}`));
    console.log(colors.blue(`-----------`));

    ExtractFrames(videoPath, options)
      .then(images => {

        yes(Q.map(images, (imagePath) => (faceDetectImage(imagePath)), { concurrency: 1 })
          .then(results => {

            if (!_.compact(results).length && options.removeOriginalVideo) {
              fs.unlinkSync(videoPath)
            }

            const frameInterval = videoTotalFrames / images.length

              const firstPass = results.map((faces, i) => {
              const nextFrame = (i + 1) * frameInterval
              const frame = i * frameInterval
              const startTime = frame / videoFps
              const endTime = Math.min(nextFrame / videoFps, videoDuration)

              return {
                index: i,
                frame: frame,
                videoPath: videoPath,
                imagePath: images[i],
                startTime: startTime,
                endTime: endTime,
                partOfFaceGroup: !!faces, //did it find any faces on frame
                faces: faces,
              }
            })

            const lookbackFrames = Math.ceil(videoFps * options.lookbackSecs * fps)


            for (var i = 0; i < firstPass.length; i++) {
              const c = firstPass[i]
              const p = firstPass[i - 1] || {}
              if (!p.partOfFaceGroup && c.partOfFaceGroup) {
                const farback = firstPass[i - lookbackFrames]
                if (farback) {
                  if (farback.partOfFaceGroup) {
                    for (var j = i - lookbackFrames; j < i; j++) {
                      firstPass[j].partOfFaceGroup = true
                    }
                  }
                }
              }
            }


            return firstPass

          })
        );
      })
  })
}

const FacesFromVideo = (videoPath, options) => {
  return new Q((yes, no) => {
    var vid = new cv.VideoCapture(videoPath)
    vid.read(function(err, mat) {
      if (err) throw err;

      let x = 0;
      const frameFaces = []
      const totalFrames = vid.getFrameCount()
      console.log("totalFrames", totalFrames);

      const iter = function() {

        vid.read(function(err, m2) {
          x++;
          m2.detectObject(cv.FACE_CASCADE, {}, function(err, faces) {
            /*for (var i = 0; i < faces.length; i++) {
              var face = faces[i];
              m2.ellipse(face.x + face.width / 2, face.y + face.height / 2, face.width / 2, face.height / 2);
            }
            if(faces.length){
              console.log(x);
              fs.writeFileSync(`${x}.jpg`, m2.toBuffer())
              //m2.save(`./faces/${x}.png`);
            }*/
            if(faces.length){
              console.log(colors.green(`Face at frame: ${x} of ${videoPath}`));
              frameFaces.push({ frame: x, faces })
            }
          })
          if (x < totalFrames) {
            iter();
          } else {
            yes(frameFaces)
          }
        })
      }
      iter();
    })
  })
}

module.exports = { ExtractFrames, FaceFromClip, FacesFromVideo }
  /*



  ffmpeg -i "$1" -vf "fps=1/60,scale=-1:360" -y "output_frames/$(basename $1)%03d.jpg"

  'use strict';
  // When opening a file, the full path must be passed to opencv
  var vid = new cv.VideoCapture(path.join(__dirname, 'data', 'fake.mkv'));
  const totalFrames = vid.getFrameCount()
  console.log("totalFrames", totalFrames);
  vid.read(function(err, mat) {
    if (err) throw err;
    var x = 0;
    var iter = function() {

      vid.read(function(err, m2) {
        x++;
        m2.detectObject(cv.FACE_CASCADE, {}, function(err, faces) {
            console.log(x);
            console.log(faces);
            for (var i = 0; i < faces.length; i++) {
              var face = faces[i];
              m2.ellipse(face.x + face.width / 2, face.y + face.height / 2, face.width / 2, face.height / 2);
            }
            if(faces.length){
              m2.save(`faces/${x}.png`);
            }
          })
        if (x < totalFrames)
          iter();
      })
    }
    iter();
  })
  */
