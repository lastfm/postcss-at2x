'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

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
      resolveImagePath = _ref$resolveImagePath === undefined ? defaultResolveImagePath : _ref$resolveImagePath;

  return function (root) {
    // Create an empty rule so that all the new rules can be appended to this
    // and then append it at the end.
    var ruleContainer = _postcss2.default.root();

    var rules = [];

    root.walkRules(function (rule) {
      var mediaParent = rule.parent;

      // Check for any `background-size` declarations and keep a reference to it
      // These need to be added again to prevent it being overridden by usage of
      // the `background` shorthand
      var backgroundSize = void 0;
      rule.walkDecls('background-size', function (decl) {
        backgroundSize = decl;
      });

      rule.walkDecls(/^background/, function (decl) {
        if (!backgroundWithHiResURL(decl.value)) {
          return;
        }

        // Construct a duplicate rule but with the image urls
        // replaced with retina versions
        var retinaRule = _postcss2.default.rule({ selector: decl.parent.selector });

        retinaRule.append(decl.clone({
          value: createRetinaUrl(decl.value, identifier)
        }));

        // Remove keyword from original declaration here as createRetinaUrl
        // needs it for regex search
        decl.value = removeKeyword(decl.value);

        var promise = getBackgroundImageSize(decl, backgroundSize, detectImageSize, resolveImagePath).then(function (size) {
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

function getBackgroundImageSize(decl, existingBackgroundSize, detectImageSize, resolveImagePath) {
  if (!detectImageSize) {
    return Promise.resolve(existingBackgroundSize);
  }

  var parsedValue = (0, _postcssValueParser2.default)(decl.value);
  var urlValue = '';

  parsedValue.walk(function (node) {
    if (node.type !== 'function' || node.type === 'function' && node.value !== 'url') {
      return;
    }
    node.nodes.forEach(function (fp) {
      if (!(0, _isUrl2.default)(fp.value)) {
        urlValue = resolveImagePath(fp.value, decl.source);
      }
    });
  });

  var result = Promise.resolve();

  if (urlValue !== '') {
    return result.then(function () {
      return (0, _pify2.default)(_imageSize2.default)(urlValue);
    }).then(function (size) {
      return _postcss2.default.decl({
        prop: 'background-size',
        value: size.width + 'px ' + size.height + 'px'
      });
    });
  }

  return result;
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

// Matches `url()` content as long as it is followed by `at-2x`
var urlPathRegex = /url\(([^\r\n]+)\)(?:[^\r\n]+)?at-2x/gm;

function createRetinaUrl(bgValue, identifier) {
  var match = void 0;
  // Loop over all occurances of `url()` and match the path
  while ((match = urlPathRegex.exec(bgValue)) !== null) {
    var _match = match,
        _match2 = _slicedToArray(_match, 2),
        imgUrl = _match2[1];

    var extension = _path2.default.extname(imgUrl);

    if (extension === '.svg') {
      break;
    }

    // File name without extension
    var filename = _path2.default.basename(_path2.default.basename(imgUrl), extension);

    // Replace with retina filename
    bgValue = bgValue.replace(filename + extension, filename + identifier + extension);
  }

  return removeKeyword(bgValue);
}

function removeKeyword(str) {
  return str.replace(/\sat-2x/g, '');
}

function backgroundWithHiResURL(bgValue) {
  return bgValue.includes('url(') && bgValue.includes('at-2x');
}
module.exports = exports['default'];