const express = require('express');
const path = require('path');
const fs = require('fs')
//require('dotenv').config();


const CHUNK_SIZE = 2 ** 19;

console.log('CHUNK_SIZE', CHUNK_SIZE);

var router = express.Router();
console.log('VIDEO_ROOT',process.env.VIDEO_ROOT)

if(!process.env.VIDEO_ROOT) {
    console.log('Define an environment variable named `VIDEO_ROOT` that points to the folder containing the files ready to be streamed');
}
function getVideoPath(videoID) {
    var videoRoot = process.env.VIDEO_ROOT || "src/film/";
    console.log('video root', videoRoot);
    var videoPath = path.join(videoRoot, videoID);
    console.log('path:',videoPath);
    return videoPath;
}

function getByteRange(rangeHeader) {
    console.log('Range Header:',rangeHeader)
    var byteRangeString = rangeHeader.split('=')[1];
    console.log(byteRangeString);
    byteParts = byteRangeString.split('-');
    console.log(byteParts);
    var range = [];
    range.push(Number.parseInt(byteParts[0]));
    if(byteParts[1].length == 0 ) {
        range.push(null);
    } else {
        range.push(Number.parseInt(byteParts[1]))
    }
    return range;
}

function getContentType(videoID) {
    var retVal = "video/mp4";
    var extensionStart = videoID.lastIndexOf('.')
    if(extensionStart != -1) {
        retVal = `video/${videoID.substring(extensionStart + 1)}`;
    }
    return retVal;
}

router.get('/asder:videoID', (req, res, next) => { 
    var videoID = req.params.videoID;
    const request_range  = req.headers.range;
    console.log(request_range);
    console.log(request_range)

    console.log(range);
    if(request_range == null) {
        res.status(400).send("a range header is necessary");
        return;
    }
    var range = getByteRange(request_range);
    var videoPath = getVideoPath(videoID);
    fs.stat(videoPath,(err, stat) => {
        if(err) {
            res.status(400).send(err);
            return;
        }
        var size = stat.size;

        var start = range[0];
        if(range[1]==null)
        range[1] = Math.min(size, start+CHUNK_SIZE);
        var end = range[1] ;
        end = Math.min(end, size);
        const contentLength = end - start + 1;
        console.log(`piping stream ${contentLength}`);
        const headers = { 
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges":"bytes",
            "Content-Length": contentLength,
            "Content-Type": getContentType(videoID)
        };

        console.log('headers', headers);
        res.writeHead(206, headers);
        const videoStream = fs.createReadStream(videoPath, {start, end});
        videoStream.pipe(res);
        console.log('done')
    });
});

router.get('/:id', (req, res) => {
    const videoPath = `src/film/${req.params.id}`;
    const videoStat = fs.statSync(videoPath);
    const fileSize = videoStat.size;
    const videoRange = req.headers.range;
    if (videoRange) {
        const parts = videoRange.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1]
            ? parseInt(parts[1], 10)
            : fileSize-1;
        const chunksize = (end-start) + 1;
        const file = fs.createReadStream(videoPath, {start, end});
        const header = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, header);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});


module.exports = router;