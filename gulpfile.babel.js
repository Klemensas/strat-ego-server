import _ from 'lodash';
import del from 'del';
import gulp from 'gulp';
import path from 'path';
import gulpLoadPlugins from 'gulp-load-plugins';
import http from 'http';
import lazypipe from 'lazypipe';
import nodemon from 'nodemon';
import runSequence from 'run-sequence';

var plugins = gulpLoadPlugins();
var config;

const serverPath = 'src';
const paths = {
    server: {
        scripts: [`${serverPath}/**/!(*.spec|*.integration).js`],
        json: [`${serverPath}/**/*.json`],
        test: {
          integration: [`${serverPath}/**/*.integration.js`, 'mocha.global.js'],
          unit: [`${serverPath}/**/*.spec.js`, 'mocha.global.js']
        }
    },
    dist: 'dist'
};


// Call page until first success
function whenServerReady(cb) {
    var serverReady = false;
    var appReadyInterval = setInterval(() =>
        checkAppReady((ready) => {
            if (!ready || serverReady) {
                return;
            }
            clearInterval(appReadyInterval);
            serverReady = true;
            cb();
        }),
        100);
}

function checkAppReady(cb) {
    var options = {
        host: 'localhost',
        port: config.port
    };
    http
        .get(options, () => cb(true))
        .on('error', () => cb(false));
}

function onServerLog(log) {
    console.log(plugins.util.colors.white('[') +
        plugins.util.colors.yellow('nodemon') +
        plugins.util.colors.white('] ') +
        log.message);
}

/********************
 * Reusable pipelines
 ********************/
let transpileServer = lazypipe()
    .pipe(plugins.sourcemaps.init)
    .pipe(plugins.babel)
    .pipe(plugins.sourcemaps.write, '.');

/********************
 * Tasks
 ********************/
gulp.task('transpile:server', () => {
    return gulp.src(_.union(paths.server.scripts, paths.server.json))
        .pipe(transpileServer())
        .pipe(gulp.dest(`${paths.dist}/${serverPath}`));
});

gulp.task('start:server', () => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    config = require(`./${serverPath}/config/environment`);
    nodemon(`-w ${serverPath} ${serverPath}`)
        .on('log', onServerLog);
});

gulp.task('clean:tmp', () => del(['.tmp/**/*'], {dot: true}));
gulp.task('clean:dist', () => del([`${paths.dist}/!(.git*|.openshift|Procfile)**`], {dot: true}));


gulp.task('watch', () => {
    plugins.livereload.listen();

    plugins.watch(paths.server.scripts)
        .pipe(plugins.plumber())
        .pipe(plugins.livereload());
});

gulp.task('env:all', () => {
    let localConfig;
    try {
        localConfig = require(`./${serverPath}/config/local.env`);
    } catch (e) {
        localConfig = {};
    }
    plugins.env({
        vars: localConfig
    });
});

gulp.task('serve', cb => {
    runSequence(
        [
            'clean:tmp',
            'env:all'
        ],
        [
            'start:server',
        ],
        'watch',
        cb
    );
});

gulp.task('build', cb => {
    runSequence(
        [
            'clean:dist',
            'clean:tmp'
        ],
        'transpile:server',
        cb);
});