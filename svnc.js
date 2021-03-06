#!/usr/bin/env node

var _ = require('lodash');
var shell = require('shelljs');
var xmlParse = require('xml2js').parseString;
var path = require('path');
var argv = require('yargs')
    .option('f',{
        alias:"prefix",
        demand:true,
        describe:'path prefix to remove',
        default:'',
        type:'string'
    })
    .option('s', {
        alias: 'search',
        demand: true,
        describe: 'msg search keyword',
        type: 'string'
    })
    .option('l', {
        demand: true,
        describe: 'num of log to parse',
        default: '20',
        type: 'int'
    })
    .option('p', {
        alias: 'path',
        demand: true,
        default: '.',
        type: 'string'
    }).argv;

var svnPath = argv.p;
var keyWord = argv.s;
var logNum = argv.l;
var prefix=argv.f;

function initDefault() {
    if (argv.f === '') {
        var tmpRelativePathResult = shell.exec('svnp -p ' + svnPath,{silent:true});
        if (tmpRelativePathResult.code === 0) {
            prefix=tmpRelativePathResult.output;
        } else {
            prefix='';
        }
    }else{
        prefix='';
    }
}

initDefault();

var addFiles = [];
var delFiles = [];
var modFiles = [];
var delDirs = [];

function parsePathObj(item) {
    var tempKind = item.$.kind; //node type
    var tempAction = item.$.action; //svn modify type
    var tempPath = item._; //path
    if (tempKind === 'dir') { //for dir
        if (tempAction === 'D') {
            delDirs.push(tempPath);
        }
    } else if (tempKind === 'file') { //for files
        if (tempAction === 'A') {
            addFiles.push(tempPath);
        } else if (tempAction === 'M') {
            modFiles.push(tempPath);
        } else if (tempAction === 'D') {
            delFiles.push(tempPath);
        }
    }
}

function addChangeToStr(str, headStr, contents, handleFunc) {
    if (contents.length === 0) {
        return str;
    }
    str += headStr + '\n';
    contents = _.map(contents, handleFunc);
    str += (contents.join(',\n'));
    return str + '\n';
}

function lineHandle(line) {
    line = _.trimLeft(line, prefix);
    line = line.replace(/\//g, '\\');
    return line;
}


var command='svn log -l ' + logNum + ' -v --xml --search '+keyWord+' '+svnPath;
shell.exec(command, {
    silent: true
}, function(code, output) {
    if(code!==0){
        console.error('error:',output);
        return;
    }
    xmlParse(output, function(err, result) {
        if(err){
            console.error('error:',err);
            return;
        }
        var logentrys = result.log.logentry;
        _.forEach(logentrys, function(logentry) {
            var paths = logentry.paths[0].path;
            _.forEach(paths, function(path) {
                parsePathObj(path);
            })
        });
    });
    var changeStr = '';
    changeStr = addChangeToStr(changeStr, '新增文件:', addFiles, lineHandle);
    changeStr = addChangeToStr(changeStr, '修改文件:', modFiles, lineHandle);
    changeStr = addChangeToStr(changeStr, '删除文件:', delFiles, lineHandle);
    changeStr = addChangeToStr(changeStr, '删除文件夹:', delDirs, lineHandle);
    console.log(changeStr);
});
