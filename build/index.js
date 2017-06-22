'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _isUrl = require('is-url');

var _isUrl2 = _interopRequireDefault(_isUrl);

var _imageSize = require('image-size');

var _imageSize2 = _interopRequireDefault(_imageSize);

var _pify = require('pify');

var _pify2 = _interopRequireDefault(_pify);

require('string.prototype.includes');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defaultResolutions = ['(min-device-pixel-ratio: 1.5)', '(min-resolution: 144dpi)', '(min-resolution: 1.5dppx)'];

function defaultResolveImagePath(value) {
  return _path2.default.resolve(process.cwd(), value);
}

exports.default = _postcss2.default.plugin('postcss-at2x', at2x);


function at2x() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$identifier = _ref.identifier,
      identifier = _ref$identifier === undefined ? '@2x' : _ref$identifier,
      _ref$detectImageSize = _ref.detectImageSize,
      detectImageSize = _ref$detectImageSize === undefined ? false : _ref$detectImageSize,
      _ref$resolveImagePath = _ref.resolveImagePath,
      resolveImagePath = _ref$resolveImagePath === undefined ? defaultResolveImagePath : _ref$resolveImagePath,
      _ref$skipMissingRetin = _ref.skipMissingRetina,
      skipMissingRetina = _ref$skipMissingRetin === undefined ? false : _ref$skipMissingRetin;

  return function (root, result) {
    // Create an empty rule so that all the new rules can be appended to this
    // and then append it at the end.
    var ruleContainer = _postcss2.default.root();

    var rules = [];

    root.walkRules(function (rule) {
      var mediaParent = rule.parent;

      rule.walkDecls(/^background/, function (decl) {
        if (!backgroundWithHiResURL(decl.value)) {
          return;
        }

        // Construct a duplicate rule but with the image urls
        // replaced with retina versions
        var retinaRule = _postcss2.default.rule({ selector: decl.parent.selector });

        var retinaImages = createRetinaImages(decl.value, identifier);

        // Remove keyword from original declaration here as createRetinaImages needs it
        decl.value = removeKeyword(decl.value);

        if (skipMissingRetina && !retinaImageExists(retinaImages, decl.source, resolveImagePath)) {
          return;
        }

        retinaRule.append(_postcss2.default.decl({
          prop: 'background-image',
          value: retinaImages
        }));

        var promise = getBackgroundImageSize(decl, detectImageSize, resolveImagePath, result.warn.bind(result)).then(function (size) {
          if (size) {
            retinaRule.append(_postcss2.default.decl(size));
          }

          // Create the rules and append them to the container
          var params = mediaParent.name === 'media' ? combineMediaQuery(mediaParent.params.split(/,\s*/), defaultResolutions) : defaultResolutions.join(', ');
          var mediaAtRule = _postcss2.default.atRule({ name: 'media', params: params });

          mediaAtRule.append(retinaRule);
          ruleContainer.append(mediaAtRule);
        });

        rules.push(promise);
      });
    });

    return Promise.all(rules).then(function () {
      root.append(ruleContainer);
    });
  };
}

function retinaImageExists(retinaUrl, source, resolveImagePath) {
  var urlValue = extractUrlValue(retinaUrl, source, resolveImagePath);
  return _fs2.default.existsSync(urlValue);
}

function getBackgroundImageSize(decl, detectImageSize, resolveImagePath, warn) {
  if (!detectImageSize) {
    return Promise.resolve();
  }

  var urlValue = extractUrlValue(decl.value, decl.source, resolveImagePath);
  var result = Promise.resolve();

  if (urlValue !== '') {
    return result.then(function () {
      return (0, _pify2.default)(_imageSize2.default)(urlValue);
    }).then(function (size) {
      return _postcss2.default.decl({
        prop: 'background-size',
        value: size.width + 'px ' + size.height + 'px'
      });
    }).catch(function (err) {
      warn(err);
    });
  }

  return result;
}

function extractUrlValue(url, source, resolveImagePath) {
  var parsedValue = (0, _postcssValueParser2.default)(url);
  var urlValue = '';

  parsedValue.walk(function (node) {
    if (node.type !== 'function' || node.type === 'function' && node.value !== 'url') {
      return;
    }
    node.nodes.forEach(function (fp) {
      if (!(0, _isUrl2.default)(fp.value)) {
        urlValue = resolveImagePath(fp.value, source);
      }
    });
  });
  return urlValue;
}

/**
 * Add all the resolutions to each media query to scope them
 */
function combineMediaQuery(queries, resolutions) {
  return queries.reduce(function (finalQuery, query) {
    resolutions.forEach(function (resolution) {
      return finalQuery.push(query + ' and ' + resolution);
    });
    return finalQuery;
  }, []).join(', ');
}

function createRetinaImages(bgValue, identifier) {
  var backgrounds = splitMultipleBackgrounds(bgValue);
  var images = backgrounds.map(extractRetinaImage.bind(this, identifier));
  return images.join(', ');
}

// Matches the <image> type and value within a background definition
var imageRegex = /([^\s]+)\((.+)\)/;

// Returns the <image> part of the background definition,
// and includes the identifier if it meets the criteria:
// * It's a url() image
// * It's not an svg
// * The background definition has at-2x applied
function extractRetinaImage(identifier, background) {
  var match = background.match(imageRegex);

  var _match = _slicedToArray(match, 3),
      image = _match[0],
      type = _match[1],
      value = _match[2];

  if (background.indexOf('at-2x') === -1 || type !== 'url') {
    return image;
  }

  var extension = _path2.default.extname(value);

  if (extension === '.svg') {
    return image;
  }

  // File name without extension
  var filename = _path2.default.basename(_path2.default.basename(value), extension);
  // Replace with retina filename
  return image.replace(filename + extension, filename + identifier + extension);
}

function splitMultipleBackgrounds(value) {
  var backgrounds = [];
  var opened = 0;
  value.split(',').forEach(function (part) {
    if (opened > 0) {
      backgrounds[backgrounds.length - 1] += ',' + part;
    } else {
      backgrounds.push(part);
    }
    var open = count(part, '(');
    var close = count(part, ')');
    opened += open - close;
  });
  return backgrounds;
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function removeKeyword(str) {
  return str.replace(/\sat-2x/g, '');
}

function backgroundWithHiResURL(bgValue) {
  return bgValue.includes('url(') && bgValue.includes('at-2x');
}
module.exports = exports['default'];