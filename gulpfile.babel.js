import _ from 'lodash';
import del from 'del';
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import lazypipe from 'lazypipe';
import nodemon from 'nodemon';
import runSequence from 'run-sequence';

const plugins = gulpLoadPlugins();

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

function onServerLog(log) {
  console.log(plugins.util.colors.white('[') +
        plugins.util.colors.yellow('nodemon') +
        plugins.util.colors.white('] ') +
        log.message);
}

const transpileServer = lazypipe()
    .pipe(plugins.sourcemaps.init)
    .pipe(plugins.babel, { presets: ['latest'] })
    .pipe(plugins.sourcemaps.write, '.');

gulp.task('transpile:server', () => gulp.src(_.union(paths.server.scripts, paths.server.json))
        .pipe(transpileServer())
        .pipe(gulp.dest(`${paths.dist}/${serverPath}`)));

gulp.task('start:server', () => {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  nodemon(`-w ${serverPath} ${serverPath}`)
        .on('log', onServerLog);
});

gulp.task('clean:dist', () => del([`${paths.dist}/!(.git*|.openshift|Procfile)**`], { dot: true }));
gulp.task('watch', () => {
  plugins.livereload.listen();

  plugins.watch(paths.server.scripts)
        .pipe(plugins.livereload());
});
gulp.task('serve', cb => {
  runSequence(
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
    ],
        'transpile:server',
        cb);
});
