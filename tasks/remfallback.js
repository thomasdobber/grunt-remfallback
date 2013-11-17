/*
 * grunt-remfallback
 * https://github.com/thomasdobber/grunt-remfallback
 *
 * Copyright (c) 2013 Thomas Dobber
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt){

  grunt.registerMultiTask('remfallback', 'Finds rem values in CSS and creates fallbacks with px values.', function(){
    
    // requirements
    var parse = require('css-parse'),
        stringify = require('css-stringify');

    // options
    var options = this.options({
      log: false
    });

    this.files.forEach(function(f){
    
      // get file contents
      var contents = f.src.filter(function(filepath) {
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        return grunt.file.read(filepath);
      }).join('\n');

      // parse the contents and setup objects used for combining and sorting
      var json = parse(contents),
          rootSize = 16,
          regexHtml = /^html$|\w*\s+html$/,
          regexRem = /[0-9]+rem/,
          regexFont = /\s*(.*)\//,
          remFound = 0;
      
      // round floating numbers
      function preciseRound(num,decimals){
        return Math.round(num*Math.pow(10,decimals))/Math.pow(10,decimals);
      }

      // convert rem to px
      function remToPx(remArray){

        var pxArray = remArray.map(function(v){
          if( v.match(regexRem) ){

            // this one is needed to split properties like '2rem/1.5'
            var restValue = '';
            if( v.match(/\//) ){
              restValue = v.match(/\/.*/);
            }

            // replace 'rem' and anything that comes after it, we'll repair this later
            var unitlessValue = v.replace(/rem.*/, '');
            var pxValue = preciseRound(unitlessValue * rootSize, 1) + 'px';
            var newValue = restValue ? pxValue + restValue : pxValue;

            remFound++;
            return newValue;
          }
          return v;
        }).join(' ');

        return pxArray;
      }

      // function to clone object
      function clone(obj){
        var copy = {};
        for (var attr in obj) {
          if (obj.hasOwnProperty(attr)){
            copy[attr] = obj[attr];
          }
        }
        return copy;
      }

      // create a base value from px,em,rem or percentage
      function createBaseSize(value){
        if(value.match(/px/)){
          return value.replace(/px/, ''); }

        if(value.match(/em|rem/)){
          return value.replace(/em|rem/, '') * 16; }

        if(value.match(/%/)){
          return value.replace(/%/, '')/100 * 16; }
      }

      // find root font-size declarations
      function findRoot(r){
        r.selectors.forEach(function(s){

          // look for 'html' selectors
          if(s.match(regexHtml)){

            r.declarations.forEach(function(d){
              var foundSize = false;

              // look for the 'font' property
              if (d.property === 'font' && d.value.match(regexFont)){
                foundSize = d.value.match(regexFont)[1];
              }

              // look for the 'font-size' property
              else if (d.property === 'font-size'){
                foundSize = d.value;
              }

              // update root size if new one is found
              if(foundSize){
                rootSize = createBaseSize(foundSize);
              }   
            });
          }
        });
      }

      // look for rem values
      function findRems(rule){
        
        for (var i = 0; i < rule.declarations.length; i++){
          var declaration = rule.declarations[i];

          // grab values that contain 'rem'
          if(declaration.type === 'declaration' && declaration.value.match(regexRem)) {
            var remValueList = declaration.value.split(/\s/);
            var pxValues = remToPx(remValueList);

            // create the fallback
            var fallback = clone(declaration);
            fallback.value = pxValues;

            // insert fallback before original
            rule.declarations.splice(i, 0, fallback);

            i++;
          }
        }
      }

      // go through all the rules
      json.stylesheet.rules.forEach(function(rule){

        // normal rules
        if(rule.type === 'rule'){
          findRoot(rule);
          findRems(rule);
        } 

        // media queries
        if(rule.type === 'media'){
          rule.rules.forEach(function(mediaRule){
            if(mediaRule.type === 'rule'){
              findRoot(mediaRule);
              findRems(mediaRule);
            }
          });
        }
      });

      // log stuff
      if(options.log){
        grunt.log.writeln('------------------------------------');
        grunt.log.writeln('Root size found: ' + rootSize + 'px');
        grunt.log.writeln('Rem units found: '+ remFound);
        grunt.log.writeln('------------------------------------');
      }

      // write the new file
      grunt.file.write(f.dest, stringify(json) );
      grunt.log.ok('File "' + f.dest + '" created.');
    });
  });
};