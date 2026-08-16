var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/ipaddr.js@2.4.0/node_modules/ipaddr.js/lib/ipaddr.js
var require_ipaddr = __commonJS({
  "../../node_modules/.pnpm/ipaddr.js@2.4.0/node_modules/ipaddr.js/lib/ipaddr.js"(exports, module) {
    (function(root) {
      "use strict";
      const ipv4Part = "(0?\\d+|0x[a-f0-9]+)";
      const ipv4Regexes = {
        fourOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, "i"),
        threeOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, "i"),
        twoOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}$`, "i"),
        longValue: new RegExp(`^${ipv4Part}$`, "i")
      };
      const octalRegex = new RegExp(`^0[0-7]+$`, "i");
      const hexRegex = new RegExp(`^0x[a-f0-9]+$`, "i");
      const zoneIndex = "%[0-9a-z]{1,}";
      const ipv6Part = "(?:[0-9a-f]+::?)+";
      const ipv6Regexes = {
        zoneIndex: new RegExp(zoneIndex, "i"),
        "native": new RegExp(`^(::)?(${ipv6Part})?([0-9a-f]+)?(::)?(${zoneIndex})?$`, "i"),
        deprecatedTransitional: new RegExp(`^(?:::)(${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?)$`, "i"),
        transitional: new RegExp(`^((?:${ipv6Part})|(?:::)(?:${ipv6Part})?)${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?$`, "i")
      };
      function expandIPv6(string, parts) {
        if (string.indexOf("::") !== string.lastIndexOf("::")) {
          return null;
        }
        let colonCount = 0;
        let lastColon = -1;
        let zoneId = (string.match(ipv6Regexes.zoneIndex) || [])[0];
        let replacement, replacementCount;
        if (zoneId) {
          zoneId = zoneId.substring(1);
          string = string.replace(/%.+$/, "");
        }
        while ((lastColon = string.indexOf(":", lastColon + 1)) >= 0) {
          colonCount++;
        }
        if (string.substr(0, 2) === "::") {
          colonCount--;
        }
        if (string.substr(-2, 2) === "::") {
          colonCount--;
        }
        if (colonCount > parts) {
          return null;
        }
        replacementCount = parts - colonCount;
        replacement = ":";
        while (replacementCount--) {
          replacement += "0:";
        }
        string = string.replace("::", replacement);
        if (string[0] === ":") {
          string = string.slice(1);
        }
        if (string[string.length - 1] === ":") {
          string = string.slice(0, -1);
        }
        parts = (function() {
          const ref = string.split(":");
          const results = [];
          for (let i = 0; i < ref.length; i++) {
            results.push(parseInt(ref[i], 16));
          }
          return results;
        })();
        return {
          parts,
          zoneId
        };
      }
      function matchCIDR(first, second, partSize, cidrBits) {
        if (first.length !== second.length) {
          throw new Error("ipaddr: cannot match CIDR for objects with different lengths");
        }
        let part = 0;
        let shift;
        while (cidrBits > 0) {
          shift = partSize - cidrBits;
          if (shift < 0) {
            shift = 0;
          }
          if (first[part] >> shift !== second[part] >> shift) {
            return false;
          }
          cidrBits -= partSize;
          part += 1;
        }
        return true;
      }
      function parseIntAuto(string) {
        if (hexRegex.test(string)) {
          return parseInt(string, 16);
        }
        if (string[0] === "0" && !isNaN(parseInt(string[1], 10))) {
          if (octalRegex.test(string)) {
            return parseInt(string, 8);
          }
          throw new Error(`ipaddr: cannot parse ${string} as octal`);
        }
        return parseInt(string, 10);
      }
      function padPart(part, length) {
        while (part.length < length) {
          part = `0${part}`;
        }
        return part;
      }
      const ipaddr2 = {};
      ipaddr2.IPv4 = (function() {
        function IPv4(octets) {
          if (octets.length !== 4) {
            throw new Error("ipaddr: ipv4 octet count should be 4");
          }
          let i, octet;
          for (i = 0; i < octets.length; i++) {
            octet = octets[i];
            if (!(0 <= octet && octet <= 255)) {
              throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
            }
          }
          this.octets = octets;
        }
        IPv4.prototype.SpecialRanges = {
          unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
          broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
          // RFC3171
          multicast: [[new IPv4([224, 0, 0, 0]), 4]],
          // RFC3927
          linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
          // RFC5735
          loopback: [[new IPv4([127, 0, 0, 0]), 8]],
          // RFC6598
          carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],
          // RFC1918
          "private": [
            [new IPv4([10, 0, 0, 0]), 8],
            [new IPv4([172, 16, 0, 0]), 12],
            [new IPv4([192, 168, 0, 0]), 16]
          ],
          // Reserved and testing-only ranges; RFCs 5735, 5737, 2544, 1700
          reserved: [
            [new IPv4([192, 0, 0, 0]), 24],
            [new IPv4([192, 0, 2, 0]), 24],
            [new IPv4([192, 88, 99, 0]), 24],
            [new IPv4([198, 18, 0, 0]), 15],
            [new IPv4([198, 51, 100, 0]), 24],
            [new IPv4([203, 0, 113, 0]), 24],
            [new IPv4([240, 0, 0, 0]), 4]
          ],
          // RFC7534, RFC7535
          as112: [
            [new IPv4([192, 175, 48, 0]), 24],
            [new IPv4([192, 31, 196, 0]), 24]
          ],
          // RFC7450
          amt: [
            [new IPv4([192, 52, 193, 0]), 24]
          ]
        };
        IPv4.prototype.kind = function() {
          return "ipv4";
        };
        IPv4.prototype.match = function(other, cidrRange) {
          let ref;
          if (cidrRange === void 0) {
            ref = other;
            other = ref[0];
            cidrRange = ref[1];
          }
          if (other.kind() !== "ipv4") {
            throw new Error("ipaddr: cannot match ipv4 address with non-ipv4 one");
          }
          return matchCIDR(this.octets, other.octets, 8, cidrRange);
        };
        IPv4.prototype.prefixLengthFromSubnetMask = function() {
          let cidr = 0;
          let stop = false;
          const zerotable = {
            0: 8,
            128: 7,
            192: 6,
            224: 5,
            240: 4,
            248: 3,
            252: 2,
            254: 1,
            255: 0
          };
          let i, octet, zeros;
          for (i = 3; i >= 0; i -= 1) {
            octet = this.octets[i];
            if (octet in zerotable) {
              zeros = zerotable[octet];
              if (stop && zeros !== 0) {
                return null;
              }
              if (zeros !== 8) {
                stop = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 32 - cidr;
        };
        IPv4.prototype.range = function() {
          return ipaddr2.subnetMatch(this, this.SpecialRanges);
        };
        IPv4.prototype.toByteArray = function() {
          return this.octets.slice(0);
        };
        IPv4.prototype.toIPv4MappedAddress = function() {
          return ipaddr2.IPv6.parse(`::ffff:${this.toString()}`);
        };
        IPv4.prototype.toNormalizedString = function() {
          return this.toString();
        };
        IPv4.prototype.toString = function() {
          return this.octets.join(".");
        };
        return IPv4;
      })();
      ipaddr2.IPv4.broadcastAddressFromCIDR = function(string) {
        try {
          const cidr = this.parseCIDR(string);
          const ipInterfaceOctets = cidr[0].toByteArray();
          const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          const octets = [];
          let i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv4 CIDR format");
        }
      };
      ipaddr2.IPv4.isIPv4 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr2.IPv4.isValid = function(string) {
        try {
          new this(this.parser(string));
          return true;
        } catch (e) {
          return false;
        }
      };
      ipaddr2.IPv4.isValidCIDR = function(string) {
        try {
          this.parseCIDR(string);
          return true;
        } catch (e) {
          return false;
        }
      };
      ipaddr2.IPv4.isValidFourPartDecimal = function(string) {
        if (ipaddr2.IPv4.isValid(string) && string.match(/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/)) {
          return true;
        } else {
          return false;
        }
      };
      ipaddr2.IPv4.isValidCIDRFourPartDecimal = function(string) {
        const match = string.match(/^(.+)\/(\d+)$/);
        if (!ipaddr2.IPv4.isValidCIDR(string) || !match) {
          return false;
        }
        return ipaddr2.IPv4.isValidFourPartDecimal(match[1]);
      };
      ipaddr2.IPv4.networkAddressFromCIDR = function(string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv4 CIDR format");
        }
      };
      ipaddr2.IPv4.parse = function(string) {
        const parts = this.parser(string);
        if (parts === null) {
          throw new Error("ipaddr: string is not formatted like an IPv4 Address");
        }
        return new this(parts);
      };
      ipaddr2.IPv4.parseCIDR = function(string) {
        let match;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          const maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 32) {
            const parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv4 CIDR range");
      };
      ipaddr2.IPv4.parser = function(string) {
        let match, part, value;
        if (match = string.match(ipv4Regexes.fourOctet)) {
          return (function() {
            const ref = match.slice(1, 6);
            const results = [];
            for (let i = 0; i < ref.length; i++) {
              part = ref[i];
              results.push(parseIntAuto(part));
            }
            return results;
          })();
        } else if (match = string.match(ipv4Regexes.longValue)) {
          value = parseIntAuto(match[1]);
          if (value > 4294967295 || value < 0) {
            throw new Error("ipaddr: address outside defined range");
          }
          return (function() {
            const results = [];
            let shift;
            for (shift = 0; shift <= 24; shift += 8) {
              results.push(value >> shift & 255);
            }
            return results;
          })().reverse();
        } else if (match = string.match(ipv4Regexes.twoOctet)) {
          return (function() {
            const ref = match.slice(1, 4);
            const results = [];
            value = parseIntAuto(ref[1]);
            if (value > 16777215 || value < 0) {
              throw new Error("ipaddr: address outside defined range");
            }
            results.push(parseIntAuto(ref[0]));
            results.push(value >> 16 & 255);
            results.push(value >> 8 & 255);
            results.push(value & 255);
            return results;
          })();
        } else if (match = string.match(ipv4Regexes.threeOctet)) {
          return (function() {
            const ref = match.slice(1, 5);
            const results = [];
            value = parseIntAuto(ref[2]);
            if (value > 65535 || value < 0) {
              throw new Error("ipaddr: address outside defined range");
            }
            results.push(parseIntAuto(ref[0]));
            results.push(parseIntAuto(ref[1]));
            results.push(value >> 8 & 255);
            results.push(value & 255);
            return results;
          })();
        } else {
          return null;
        }
      };
      ipaddr2.IPv4.subnetMaskFromPrefixLength = function(prefix) {
        prefix = parseInt(prefix);
        if (prefix < 0 || prefix > 32) {
          throw new Error("ipaddr: invalid IPv4 prefix length");
        }
        const octets = [0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 4) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr2.IPv6 = (function() {
        function IPv6(parts, zoneId) {
          let i, part;
          if (parts.length === 16) {
            this.parts = [];
            for (i = 0; i <= 14; i += 2) {
              this.parts.push(parts[i] << 8 | parts[i + 1]);
            }
          } else if (parts.length === 8) {
            this.parts = parts;
          } else {
            throw new Error("ipaddr: ipv6 part count should be 8 or 16");
          }
          for (i = 0; i < this.parts.length; i++) {
            part = this.parts[i];
            if (!(0 <= part && part <= 65535)) {
              throw new Error("ipaddr: ipv6 part should fit in 16 bits");
            }
          }
          if (zoneId) {
            this.zoneId = zoneId;
          }
        }
        IPv6.prototype.SpecialRanges = {
          // RFC4291, here and after
          unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],
          linkLocal: [new IPv6([65152, 0, 0, 0, 0, 0, 0, 0]), 10],
          multicast: [new IPv6([65280, 0, 0, 0, 0, 0, 0, 0]), 8],
          loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],
          uniqueLocal: [new IPv6([64512, 0, 0, 0, 0, 0, 0, 0]), 7],
          ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 65535, 0, 0]), 96],
          // RFC3879
          deprecatedSiteLocal: [new IPv6([65216, 0, 0, 0, 0, 0, 0, 0]), 10],
          // RFC6666
          discard: [new IPv6([256, 0, 0, 0, 0, 0, 0, 0]), 64],
          // RFC6145
          rfc6145: [new IPv6([0, 0, 0, 0, 65535, 0, 0, 0]), 96],
          rfc6052: [
            // RFC6052
            [new IPv6([100, 65435, 0, 0, 0, 0, 0, 0]), 96],
            // RFC8215
            [new IPv6([100, 65435, 1, 0, 0, 0, 0, 0]), 48]
          ],
          // RFC3056
          "6to4": [new IPv6([8194, 0, 0, 0, 0, 0, 0, 0]), 16],
          // RFC6052, RFC6146
          teredo: [new IPv6([8193, 0, 0, 0, 0, 0, 0, 0]), 32],
          // RFC5180
          benchmarking: [new IPv6([8193, 2, 0, 0, 0, 0, 0, 0]), 48],
          // RFC7450
          amt: [new IPv6([8193, 3, 0, 0, 0, 0, 0, 0]), 32],
          as112v6: [
            // RFC7535
            [new IPv6([8193, 4, 274, 0, 0, 0, 0, 0]), 48],
            // RFC7534
            [new IPv6([9760, 79, 32768, 0, 0, 0, 0, 0]), 48]
          ],
          // RFC4843
          deprecatedOrchid: [new IPv6([8193, 16, 0, 0, 0, 0, 0, 0]), 28],
          // RFC7343
          orchid2: [new IPv6([8193, 32, 0, 0, 0, 0, 0, 0]), 28],
          // RFC9374
          droneRemoteIdProtocolEntityTags: [new IPv6([8193, 48, 0, 0, 0, 0, 0, 0]), 28],
          // RFC9602
          segmentRouting: [new IPv6([24320, 0, 0, 0, 0, 0, 0, 0]), 16],
          reserved: [
            // RFC3849
            [new IPv6([8193, 0, 0, 0, 0, 0, 0, 0]), 23],
            // RFC2928
            [new IPv6([8193, 3512, 0, 0, 0, 0, 0, 0]), 32],
            // RFC9637
            [new IPv6([16383, 0, 0, 0, 0, 0, 0, 0]), 20]
          ]
        };
        IPv6.prototype.isIPv4MappedAddress = function() {
          return this.range() === "ipv4Mapped";
        };
        IPv6.prototype.kind = function() {
          return "ipv6";
        };
        IPv6.prototype.match = function(other, cidrRange) {
          let ref;
          if (cidrRange === void 0) {
            ref = other;
            other = ref[0];
            cidrRange = ref[1];
          }
          if (other.kind() !== "ipv6") {
            throw new Error("ipaddr: cannot match ipv6 address with non-ipv6 one");
          }
          return matchCIDR(this.parts, other.parts, 16, cidrRange);
        };
        IPv6.prototype.prefixLengthFromSubnetMask = function() {
          let cidr = 0;
          let stop = false;
          const zerotable = {
            0: 16,
            32768: 15,
            49152: 14,
            57344: 13,
            61440: 12,
            63488: 11,
            64512: 10,
            65024: 9,
            65280: 8,
            65408: 7,
            65472: 6,
            65504: 5,
            65520: 4,
            65528: 3,
            65532: 2,
            65534: 1,
            65535: 0
          };
          let part, zeros;
          for (let i = 7; i >= 0; i -= 1) {
            part = this.parts[i];
            if (part in zerotable) {
              zeros = zerotable[part];
              if (stop && zeros !== 0) {
                return null;
              }
              if (zeros !== 16) {
                stop = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 128 - cidr;
        };
        IPv6.prototype.range = function() {
          return ipaddr2.subnetMatch(this, this.SpecialRanges);
        };
        IPv6.prototype.toByteArray = function() {
          let part;
          const bytes = [];
          const ref = this.parts;
          for (let i = 0; i < ref.length; i++) {
            part = ref[i];
            bytes.push(part >> 8);
            bytes.push(part & 255);
          }
          return bytes;
        };
        IPv6.prototype.toFixedLengthString = function() {
          const addr = (function() {
            const results = [];
            for (let i = 0; i < this.parts.length; i++) {
              results.push(padPart(this.parts[i].toString(16), 4));
            }
            return results;
          }).call(this).join(":");
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          return addr + suffix;
        };
        IPv6.prototype.toIPv4Address = function() {
          if (!this.isIPv4MappedAddress()) {
            throw new Error("ipaddr: trying to convert a generic ipv6 address to ipv4");
          }
          const ref = this.parts.slice(-2);
          const high = ref[0];
          const low = ref[1];
          return new ipaddr2.IPv4([high >> 8, high & 255, low >> 8, low & 255]);
        };
        IPv6.prototype.toNormalizedString = function() {
          const addr = (function() {
            const results = [];
            for (let i = 0; i < this.parts.length; i++) {
              results.push(this.parts[i].toString(16));
            }
            return results;
          }).call(this).join(":");
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          return addr + suffix;
        };
        IPv6.prototype.toRFC5952String = function() {
          const regex = /((^|:)(0(:|$)){2,})/g;
          const string = this.toNormalizedString();
          let bestMatchIndex = 0;
          let bestMatchLength = -1;
          let match;
          while (match = regex.exec(string)) {
            if (match[0].length > bestMatchLength) {
              bestMatchIndex = match.index;
              bestMatchLength = match[0].length;
            }
          }
          if (bestMatchLength < 0) {
            return string;
          }
          return `${string.substring(0, bestMatchIndex)}::${string.substring(bestMatchIndex + bestMatchLength)}`;
        };
        IPv6.prototype.toString = function() {
          return this.toRFC5952String();
        };
        return IPv6;
      })();
      ipaddr2.IPv6.broadcastAddressFromCIDR = function(string) {
        try {
          const cidr = this.parseCIDR(string);
          const ipInterfaceOctets = cidr[0].toByteArray();
          const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          const octets = [];
          let i = 0;
          while (i < 16) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error(`ipaddr: the address does not have IPv6 CIDR format (${e})`);
        }
      };
      ipaddr2.IPv6.isIPv6 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr2.IPv6.isValid = function(string) {
        if (typeof string === "string" && string.indexOf(":") === -1) {
          return false;
        }
        try {
          const addr = this.parser(string);
          new this(addr.parts, addr.zoneId);
          return true;
        } catch (e) {
          return false;
        }
      };
      ipaddr2.IPv6.isValidCIDR = function(string) {
        if (typeof string === "string" && string.indexOf(":") === -1) {
          return false;
        }
        try {
          this.parseCIDR(string);
          return true;
        } catch (e) {
          return false;
        }
      };
      ipaddr2.IPv6.networkAddressFromCIDR = function(string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 16) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error(`ipaddr: the address does not have IPv6 CIDR format (${e})`);
        }
      };
      ipaddr2.IPv6.parse = function(string) {
        const addr = this.parser(string);
        if (addr.parts === null) {
          throw new Error("ipaddr: string is not formatted like an IPv6 Address");
        }
        return new this(addr.parts, addr.zoneId);
      };
      ipaddr2.IPv6.parseCIDR = function(string) {
        let maskLength, match, parsed;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 128) {
            parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv6 CIDR range");
      };
      ipaddr2.IPv6.parser = function(string) {
        let addr, i, match, octet, octets, zoneId;
        if (match = string.match(ipv6Regexes.deprecatedTransitional)) {
          return this.parser(`::ffff:${match[1]}`);
        }
        if (ipv6Regexes.native.test(string)) {
          return expandIPv6(string, 8);
        }
        if (match = string.match(ipv6Regexes.transitional)) {
          zoneId = match[6] || "";
          addr = match[1];
          if (!match[1].endsWith("::")) {
            addr = addr.slice(0, -1);
          }
          addr = expandIPv6(addr + zoneId, 6);
          if (addr.parts) {
            octets = [
              parseInt(match[2]),
              parseInt(match[3]),
              parseInt(match[4]),
              parseInt(match[5])
            ];
            for (i = 0; i < octets.length; i++) {
              octet = octets[i];
              if (!(0 <= octet && octet <= 255)) {
                return null;
              }
            }
            addr.parts.push(octets[0] << 8 | octets[1]);
            addr.parts.push(octets[2] << 8 | octets[3]);
            return {
              parts: addr.parts,
              zoneId: addr.zoneId
            };
          }
        }
        return null;
      };
      ipaddr2.IPv6.subnetMaskFromPrefixLength = function(prefix) {
        prefix = parseInt(prefix);
        if (prefix < 0 || prefix > 128) {
          throw new Error("ipaddr: invalid IPv6 prefix length");
        }
        const octets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 16) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr2.fromByteArray = function(bytes) {
        const length = bytes.length;
        if (length === 4) {
          return new ipaddr2.IPv4(bytes);
        } else if (length === 16) {
          return new ipaddr2.IPv6(bytes);
        } else {
          throw new Error("ipaddr: the binary input is neither an IPv6 nor IPv4 address");
        }
      };
      ipaddr2.isValid = function(string) {
        return ipaddr2.IPv6.isValid(string) || ipaddr2.IPv4.isValid(string);
      };
      ipaddr2.isValidCIDR = function(string) {
        return ipaddr2.IPv6.isValidCIDR(string) || ipaddr2.IPv4.isValidCIDR(string);
      };
      ipaddr2.parse = function(string) {
        if (ipaddr2.IPv6.isValid(string)) {
          return ipaddr2.IPv6.parse(string);
        } else if (ipaddr2.IPv4.isValid(string)) {
          return ipaddr2.IPv4.parse(string);
        } else {
          throw new Error("ipaddr: the address has neither IPv6 nor IPv4 format");
        }
      };
      ipaddr2.parseCIDR = function(string) {
        try {
          return ipaddr2.IPv6.parseCIDR(string);
        } catch (e) {
          try {
            return ipaddr2.IPv4.parseCIDR(string);
          } catch (e2) {
            throw new Error("ipaddr: the address has neither IPv6 nor IPv4 CIDR format");
          }
        }
      };
      ipaddr2.process = function(string) {
        const addr = this.parse(string);
        if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
          return addr.toIPv4Address();
        } else {
          return addr;
        }
      };
      ipaddr2.subnetMatch = function(address, rangeList, defaultName) {
        let i, rangeName, rangeSubnets, subnet;
        if (defaultName === void 0 || defaultName === null) {
          defaultName = "unicast";
        }
        for (rangeName in rangeList) {
          if (Object.prototype.hasOwnProperty.call(rangeList, rangeName)) {
            rangeSubnets = rangeList[rangeName];
            if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
              rangeSubnets = [rangeSubnets];
            }
            for (i = 0; i < rangeSubnets.length; i++) {
              subnet = rangeSubnets[i];
              if (address.kind() === subnet[0].kind() && address.match.apply(address, subnet)) {
                return rangeName;
              }
            }
          }
        }
        return defaultName;
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = ipaddr2;
      } else {
        root.ipaddr = ipaddr2;
      }
    })(exports);
  }
});

// src/lib/pool.ts
var pool_exports = {};
__export(pool_exports, {
  pool: () => pool,
  query: () => query
});
import pg from "pg";
async function query(text, values) {
  const client = await pool.connect();
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
}
var Pool, pool;
var init_pool = __esm({
  "src/lib/pool.ts"() {
    "use strict";
    ({ Pool } = pg);
    if (!process.env.DATABASE_URL) {
      console.warn("[db] DATABASE_URL not set \u2014 database features will be unavailable.");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3,
      ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false }
    });
    pool.on("error", (err) => {
      console.error("[db] idle client error", err.message);
    });
  }
});

// test/pricing-margins.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/lib/credits.ts
var CREDIT_COSTS = {
  PHOTO_SINGLE: 2,
  PHOTO_SET_4: 8,
  /** One credit per generated second at 1080p; retail credit value is kept above $0.20. */
  VIDEO_PER_SECOND: 1,
  /**
   * 4K multiplier for video credits. Real provider pricing (Veo 3.1 Fast,
   * confirmed against Google's published rates): 1080p = $0.12/sec, 4K =
   * $0.30/sec — a 2.5x real cost jump that was previously NOT reflected in
   * credit pricing at all (4K charged the exact same 1 credit/sec as
   * 1080p). At the account's cheapest per-credit sell price (~$0.2475,
   * Agency plan), that meant every subscription plan went net-negative for
   * any subscriber who generated 4K video, and one-time video purchases
   * shrank to near-zero margin. 3 credits/sec for 4K keeps a healthy ~2.5x+
   * margin over Fast-model cost.
   */
  VIDEO_PER_SECOND_4K: 3,
  /** Conservative rates used when the operator explicitly pins Veo Standard. */
  VIDEO_PER_SECOND_STANDARD_1080P: 4,
  VIDEO_PER_SECOND_STANDARD_4K: 5,
  /** Flat surcharge for a generated narration script + TTS synthesis pass. */
  VOICEOVER: 6
};
var MIN_VIDEO_SECONDS = 8;
var MAX_VIDEO_SECONDS = 240;
var VIDEO_SCENE_SECONDS = 8;
function normalizedGeneratedSeconds(durationSeconds = MIN_VIDEO_SECONDS) {
  return Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_VIDEO_SECONDS, Math.ceil(durationSeconds / VIDEO_SCENE_SECONDS) * VIDEO_SCENE_SECONDS));
}
function videoCreditQuote(mode, skipVoiceover, durationSeconds = 8, outputQuality = "1080p") {
  if (mode === "photos" || mode === "icon") {
    return { generatedSeconds: 0, perSecondCredits: 0, videoCredits: 0, photoCredits: CREDIT_COSTS.PHOTO_SET_4, narrationCredits: 0, totalCredits: CREDIT_COSTS.PHOTO_SET_4 };
  }
  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const configuredModel = (process.env.GEMINI_VIDEO_MODEL ?? "").toLowerCase();
  const standardModel = configuredModel.includes("veo") && !configuredModel.includes("fast") && !configuredModel.includes("lite");
  const perSecondCredits = standardModel ? outputQuality === "4k" ? CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K : CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P : outputQuality === "4k" ? CREDIT_COSTS.VIDEO_PER_SECOND_4K : CREDIT_COSTS.VIDEO_PER_SECOND;
  const videoCredits = generatedSeconds * perSecondCredits;
  const photoCredits = mode === "both" ? CREDIT_COSTS.PHOTO_SET_4 : 0;
  const narrationCredits = skipVoiceover ? 0 : CREDIT_COSTS.VOICEOVER;
  return { generatedSeconds, perSecondCredits, videoCredits, photoCredits, narrationCredits, totalCredits: videoCredits + photoCredits + narrationCredits };
}
function videoCreditCost(mode, skipVoiceover, durationSeconds = 8, outputQuality = "1080p") {
  return videoCreditQuote(mode, skipVoiceover, durationSeconds, outputQuality).totalCredits;
}

// src/lib/veo.ts
import { execFile as execFile3 } from "node:child_process";
import { promisify as promisify3 } from "node:util";
import { GoogleGenAI } from "@google/genai";

// src/lib/capture.ts
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// src/lib/ssrf.ts
var import_ipaddr = __toESM(require_ipaddr(), 1);

// src/lib/capture.ts
var execFileAsync = promisify(execFile);
var ASSETS_DIR = process.env.ASSETS_DIR ?? "/tmp/aiwebvideo-assets";
var MAX_PAGES = Math.min(20, Math.max(1, Number(process.env.CAPTURE_MAX_PAGES ?? 8)));
var SETTLE_MS = Math.max(300, Math.min(3e3, Number(process.env.CAPTURE_SETTLE_MS ?? 900)));
var CAPTURE_CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.CAPTURE_CONCURRENCY ?? 1)));
var CAPTURE_BUDGET_MS = Math.max(18e4, Number(process.env.CAPTURE_TIMEOUT_MS ?? 6e5));
var CHILD_PAGE_BUDGET_MS = Math.max(18e3, Math.min(75e3, Number(process.env.CAPTURE_CHILD_TIMEOUT_MS ?? 42e3)));

// src/lib/provider-config.ts
init_pool();

// src/lib/self-hosted.ts
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";
init_pool();

// src/lib/costs.ts
init_pool();
var GEMINI_COST_CATALOG = {
  text: {
    inputToken: Number(process.env.GEMINI_TEXT_INPUT_COST_PER_MILLION_USD ?? 0.5) / 1e6,
    outputToken: Number(process.env.GEMINI_TEXT_OUTPUT_COST_PER_MILLION_USD ?? 3) / 1e6
  },
  video: {
    lite720: 0.05,
    lite1080: 0.08,
    fast720: 0.1,
    fast1080: 0.12,
    fast4k: 0.3,
    standard1080: 0.4,
    standard4k: 0.6
  },
  image: { twoK: 0.101, fourK: 0.151 },
  ttsAudioSecond: 5e-4
};

// src/lib/self-hosted.ts
var execFileAsync2 = promisify2(execFile2);

// src/lib/veo.ts
var execFileAsync3 = promisify3(execFile3);
var VIDEO_CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.AI_VIDEO_CONCURRENCY ?? 2)));
var POLL_MS = Math.max(2e3, Number(process.env.GEMINI_VIDEO_POLL_MS ?? 1e4));
var POLL_LOG_MS = Math.max(POLL_MS, Number(process.env.GEMINI_VIDEO_POLL_LOG_MS ?? 3e4));
var GENERATION_TIMEOUT_MS = Math.max(6e4, Number(process.env.GEMINI_VIDEO_TIMEOUT_MS ?? 12 * 6e4));
var DEFAULT_TOTAL_GENERATION_TIMEOUT_MS = 24 * 6e4;
var TOTAL_GENERATION_TIMEOUT_ENV = process.env.AI_VIDEO_TOTAL_TIMEOUT_MS;
var FINISHING_BUFFER_MS = 6 * 6e4;
function geminiModelChain() {
  const pinned = process.env.GEMINI_VIDEO_MODEL;
  if (pinned) return [pinned];
  return ["veo-3.1-fast-generate-preview"];
}

// src/routes/paypal.ts
import { Router } from "express";

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt2, alg) {
  if (!jwtRegex.test(jwt2))
    return false;
  try {
    const [header] = jwt2.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// src/lib/auth.ts
import jwt from "jsonwebtoken";

// src/lib/firebase-admin.ts
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
var _auth = null;
var _initialized = false;
function getFirebaseAuth() {
  if (_initialized) return _auth;
  _initialized = true;
  const cred = process.env.FIREBASE_ADMIN_CREDENTIAL_JSON;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!cred && !projectId && !(clientEmail && privateKey)) {
    console.warn("[firebase-admin] Not configured \u2014 Firebase auth verification disabled.");
    return null;
  }
  try {
    let credential;
    if (cred) {
      credential = cert(JSON.parse(cred));
    } else if (projectId && clientEmail && privateKey) {
      credential = cert({ projectId, clientEmail, privateKey });
    } else {
      credential = applicationDefault();
    }
    const app = getApps().length ? getApp() : initializeApp({ credential, projectId });
    _auth = getAuth(app);
    return _auth;
  } catch (err) {
    console.error("[firebase-admin] Init failed:", err.message);
    return null;
  }
}

// src/lib/queries.ts
init_pool();
async function getUserById(id) {
  const { rows } = await query("SELECT * FROM users WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ?? null;
}

// src/lib/auth.ts
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}
var JWT_SECRET = process.env.SESSION_SECRET ?? "development-only-secret";
function verifyLocalJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
async function resolveUser(token) {
  const configuredAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const localPayload = verifyLocalJwt(token);
  if (localPayload) {
    const row = await getUserById(localPayload.sub);
    if (!row) return null;
    return { id: row.id, email: row.email, plan: row.plan, creditsBalance: row.credits_balance, isAdmin: row.is_admin || row.email.toLowerCase() === configuredAdmin, accountStatus: row.account_status };
  }
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const pool2 = await Promise.resolve().then(() => (init_pool(), pool_exports));
    const result = await pool2.query(
      "SELECT * FROM users WHERE firebase_uid=$1 LIMIT 1",
      [decoded.uid]
    );
    const user = result.rows[0];
    if (!user) return null;
    return { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance, isAdmin: user.is_admin || user.email.toLowerCase() === configuredAdmin, accountStatus: user.account_status };
  } catch {
    return null;
  }
}
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header.", code: "UNAUTHORIZED" });
    return;
  }
  const token = header.slice(7);
  const user = await resolveUser(token);
  if (!user) {
    res.status(401).json({ error: "Token invalid or expired.", code: "UNAUTHORIZED" });
    return;
  }
  req.user = user;
  if (user.accountStatus !== "active") {
    res.status(403).json({ error: "This account is currently unavailable. Please contact support.", code: "ACCOUNT_SUSPENDED" });
    return;
  }
  next();
}

// src/routes/paypal.ts
init_pool();

// src/lib/errors.ts
var AppError = class extends Error {
  status;
  code;
  constructor(message, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
};
var FRIENDLY_FIELD_NAMES = {
  email: "email address",
  password: "password",
  url: "website URL",
  vibeBrief: "description",
  durationSeconds: "video length",
  mode: "generation mode"
};
function sendError(res, err) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error && err.name === "ZodError") {
    const issues = err.issues ?? [];
    const first = issues[0];
    const field = first ? FRIENDLY_FIELD_NAMES[String(first.path[0])] ?? String(first.path[0] ?? "input") : "input";
    const detail = first?.message === "Required" ? `Please provide your ${field}.` : first?.path[0] === "password" ? "Your password needs to be at least 6 characters." : first?.message ? first.message : `Please check the ${field} and try again.`;
    res.status(400).json({ error: detail, code: "VALIDATION_ERROR" });
    return;
  }
  if (err?.code === "22P02") {
    res.status(404).json({ error: "Job not found.", code: "NOT_FOUND" });
    return;
  }
  if (err instanceof Error) {
    console.error("[api] unhandled error:", err.message, err.stack);
    res.status(500).json({ error: "Internal server error.", code: "INTERNAL_ERROR" });
    return;
  }
  res.status(500).json({ error: "Internal server error.", code: "INTERNAL_ERROR" });
}

// src/lib/billing.ts
init_pool();
async function grantCreditsOnce(input) {
  if (!Number.isInteger(input.credits) || input.credits <= 0) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO credit_grants(grant_key,user_id,credits,plan,reason) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING grant_key`,
      [input.key, input.userId, input.credits, input.plan ?? null, input.reason]
    );
    if (!inserted.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `UPDATE users SET credits_balance=credits_balance+$1, plan=COALESCE($2,plan), updated_at=NOW() WHERE id=$3`,
      [input.credits, input.plan ?? null, input.userId]
    );
    await client.query(`INSERT INTO credit_transactions(user_id,delta,reason) VALUES ($1,$2,$3)`, [input.userId, input.credits, input.reason]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
    });
    throw error;
  } finally {
    client.release();
  }
}

// src/routes/paypal.ts
var router = Router();
var PRODUCTS = {
  creator: { env: "PAYPAL_PLAN_CREATOR", mode: "subscription", credits: 150, plan: "creator", amountUsd: 39 },
  pro: { env: "PAYPAL_PLAN_PRO", mode: "subscription", credits: 400, plan: "pro", amountUsd: 99 },
  agency: { env: "PAYPAL_PLAN_AGENCY", mode: "subscription", credits: 1e3, plan: "agency", amountUsd: 249 },
  single8: { mode: "payment", credits: 14, plan: "creator", amountUsd: 2.99 },
  single30: { mode: "payment", credits: 30, plan: "creator", amountUsd: 7.99 },
  single60: { mode: "payment", credits: 62, plan: "creator", amountUsd: 17.99 },
  topup100: { mode: "payment", credits: 100, plan: "creator", amountUsd: 25 }
};
function paypalBase() {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}
function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}
function credentialsConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
var cachedToken = null;
async function getAccessToken() {
  if (!credentialsConfigured()) throw new AppError("Billing is not configured yet.", 503, "BILLING_NOT_CONFIGURED");
  if (cachedToken && cachedToken.expiresAt > Date.now() + 3e4) return cachedToken.value;
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new AppError("Could not authenticate with PayPal.", 502, "PAYPAL_AUTH_FAILED");
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1e3 };
  return data.access_token;
}
async function paypalFetch(path, init) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.idempotencyKey ? { "PayPal-Request-Id": init.idempotencyKey } : {}
    },
    body: init.body ? JSON.stringify(init.body) : void 0
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[paypal] API error", res.status, JSON.stringify(data).slice(0, 500));
    throw new AppError("PayPal could not process this request.", 502, "PAYPAL_REQUEST_FAILED");
  }
  return data;
}
function approveLink(links) {
  if (!Array.isArray(links)) return null;
  const found = links.find((l) => l && typeof l === "object" && (l.rel === "approve" || l.rel === "payer-action"));
  return found?.href ?? null;
}
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const ids = Object.keys(PRODUCTS);
    const { plan, jobId } = external_exports.object({ plan: external_exports.enum(ids), jobId: external_exports.string().uuid().optional() }).parse(req.body);
    const product = PRODUCTS[plan];
    if (product.mode === "subscription") {
      const planId = process.env[product.env];
      if (!planId) throw new AppError(`PayPal plan ${product.env} is not configured.`, 503, "PRICE_NOT_CONFIGURED");
      const data2 = await paypalFetch("/v1/billing/subscriptions", {
        method: "POST",
        idempotencyKey: `sub-${req.user.id}-${plan}-${Date.now()}`,
        body: {
          plan_id: planId,
          custom_id: req.user.id,
          subscriber: { email_address: req.user.email },
          application_context: {
            brand_name: "AiWebVideo",
            return_url: `${appUrl()}/dashboard?checkout=success&provider=paypal${jobId ? `&job=${encodeURIComponent(jobId)}` : ""}`,
            cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
            user_action: "SUBSCRIBE_NOW"
          }
        }
      });
      const url2 = approveLink(data2.links);
      if (!url2) throw new AppError("PayPal did not return an approval URL.", 502, "CHECKOUT_FAILED");
      res.json({ checkoutUrl: url2 });
      return;
    }
    const data = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      idempotencyKey: `order-${req.user.id}-${plan}-${Date.now()}`,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: req.user.id,
          description: `AiWebVideo \u2014 ${plan}`,
          amount: { currency_code: "USD", value: product.amountUsd.toFixed(2) }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "AiWebVideo",
              user_action: "PAY_NOW",
              return_url: `${appUrl()}/api/paypal/return?plan=${plan}&userId=${req.user.id}${jobId ? `&job=${encodeURIComponent(jobId)}` : ""}`,
              cancel_url: `${appUrl()}/pricing?checkout=cancelled`
            }
          }
        }
      }
    });
    const url = approveLink(data.links);
    if (!url) throw new AppError("PayPal did not return an approval URL.", 502, "CHECKOUT_FAILED");
    await query(
      `INSERT INTO payments (user_id, provider, provider_ref, kind, amount_usd, credits_granted, plan, status)
       VALUES ($1,'paypal',$2,'one_time',$3,$4,$5,'pending')`,
      [req.user.id, data.id, product.amountUsd, product.credits, product.plan]
    );
    res.json({ checkoutUrl: url });
  } catch (err) {
    sendError(res, err);
  }
});
router.get("/return", async (req, res) => {
  const orderId = String(req.query.token ?? "");
  const jobId = typeof req.query.job === "string" && /^[0-9a-f-]{36}$/i.test(req.query.job) ? req.query.job : "";
  const redirectFail = `${appUrl()}/pricing?checkout=failed`;
  if (!orderId) {
    res.redirect(redirectFail);
    return;
  }
  try {
    const capture = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", idempotencyKey: `capture-${orderId}` });
    if (capture.status !== "COMPLETED") {
      res.redirect(redirectFail);
      return;
    }
    await grantOneTimePayment(orderId);
    res.redirect(`${appUrl()}/dashboard?checkout=success&provider=paypal${jobId ? `&job=${encodeURIComponent(jobId)}` : ""}`);
  } catch (err) {
    console.error("[paypal] return/capture error", err.message);
    res.redirect(redirectFail);
  }
});
async function grantOneTimePayment(orderId) {
  const { rows } = await query(
    "SELECT user_id, credits_granted, plan, status FROM payments WHERE provider=$1 AND provider_ref=$2",
    ["paypal", orderId]
  );
  const payment = rows[0];
  if (!payment || payment.status === "paid") return;
  await grantCreditsOnce({ key: `paypal:order:${orderId}`, userId: payment.user_id, credits: payment.credits_granted, reason: `PayPal purchase ${orderId}` });
  await query(`UPDATE payments SET status='paid' WHERE provider='paypal' AND provider_ref=$1`, [orderId]);
}
router.post("/subscriptions/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT paypal_subscription_id FROM subscriptions WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    const subscriptionId = rows[0]?.paypal_subscription_id;
    if (!subscriptionId) throw new AppError("Subscription not found.", 404, "NOT_FOUND");
    await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: { reason: "Cancelled by customer" }
    }).catch(() => {
    });
    await query(`UPDATE subscriptions SET auto_renew=false, status='cancelled', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});
async function once(eventId, action) {
  const { rowCount } = await query("INSERT INTO paypal_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id", [eventId]);
  if (!rowCount) return;
  try {
    await action();
  } catch (err) {
    await query("DELETE FROM paypal_events WHERE event_id=$1", [eventId]).catch(() => {
    });
    throw err;
  }
}
async function verifyWebhookSignature(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const result = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      transmission_id: headers["paypal-transmission-id"],
      transmission_time: headers["paypal-transmission-time"],
      cert_url: headers["paypal-cert-url"],
      auth_algo: headers["paypal-auth-algo"],
      transmission_sig: headers["paypal-transmission-sig"],
      webhook_id: webhookId,
      webhook_event: body
    }
  });
  return result.verification_status === "SUCCESS";
}
router.post("/webhook", async (req, res) => {
  try {
    if (!process.env.PAYPAL_WEBHOOK_ID) throw new AppError("PayPal webhook is not configured.", 503, "WEBHOOK_NOT_CONFIGURED");
    const event = req.body;
    const verified = await verifyWebhookSignature(req.headers, event).catch(() => false);
    if (!verified) throw new AppError("Invalid PayPal webhook signature.", 400, "INVALID_SIGNATURE");
    await once(event.id, async () => {
      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const orderId = event.resource.supplementary_data?.related_ids?.order_id;
        if (orderId) await grantOneTimePayment(orderId);
      }
      if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
        const resource = event.resource;
        const userId = resource.custom_id;
        if (!userId) return;
        const matched = Object.entries(PRODUCTS).find(([, p]) => p.mode === "subscription" && process.env[p.env] === resource.plan_id);
        if (!matched) return;
        const [, product] = matched;
        await query(`INSERT INTO subscriptions (user_id, paypal_subscription_id, plan, status, updated_at)
          VALUES ($1,$2,$3,'active',NOW()) ON CONFLICT (paypal_subscription_id)
          DO UPDATE SET plan=EXCLUDED.plan,status='active',updated_at=NOW()`, [userId, resource.id, product.plan]);
      }
      if (event.event_type === "PAYMENT.SALE.COMPLETED") {
        const resource = event.resource;
        const subscriptionId = resource.billing_agreement_id;
        if (!subscriptionId) return;
        const { rows } = await query(
          "SELECT user_id, plan FROM subscriptions WHERE paypal_subscription_id=$1",
          [subscriptionId]
        );
        const sub = rows[0];
        if (!sub) return;
        const product = Object.values(PRODUCTS).find((p) => p.mode === "subscription" && p.plan === sub.plan);
        if (!product) return;
        const existingPayments = await query(`SELECT COUNT(*)::int count FROM payments WHERE provider='paypal' AND user_id=$1 AND plan=$2 AND kind LIKE 'subscription_%' AND status='paid'`, [sub.user_id, sub.plan]);
        const kind = (existingPayments.rows[0]?.count ?? 0) === 0 ? "subscription_initial" : "subscription_renewal";
        await grantCreditsOnce({ key: `paypal:sale:${resource.id}`, userId: sub.user_id, credits: product.credits, plan: sub.plan, reason: `PayPal subscription payment ${resource.id}` });
        await query(
          `INSERT INTO payments (user_id, provider, provider_ref, kind, amount_usd, credits_granted, plan, status)
           VALUES ($1,'paypal',$2,$3,$4,$5,$6,'paid') ON CONFLICT (provider, provider_ref) DO NOTHING`,
          [sub.user_id, resource.id, kind, Number(resource.amount?.total ?? product.amountUsd), product.credits, sub.plan]
        );
      }
      if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED" || event.event_type === "BILLING.SUBSCRIPTION.EXPIRED" || event.event_type === "BILLING.SUBSCRIPTION.SUSPENDED") {
        const resource = event.resource;
        const { rows } = await query("SELECT user_id FROM subscriptions WHERE paypal_subscription_id=$1", [resource.id]);
        if (rows[0]) await query("UPDATE users SET plan='free', updated_at=NOW() WHERE id=$1", [rows[0].user_id]);
        await query("UPDATE subscriptions SET status='cancelled', auto_renew=false, updated_at=NOW() WHERE paypal_subscription_id=$1", [resource.id]);
      }
    });
    res.json({ received: true });
  } catch (err) {
    sendError(res, err);
  }
});

// test/pricing-margins.test.ts
var FAST_1080P_USD_PER_SEC = 0.12;
var FAST_4K_USD_PER_SEC = 0.3;
var STANDARD_1080P_USD_PER_SEC = 0.4;
var STANDARD_4K_USD_PER_SEC = 0.6;
var IMAGE_4K_USD = 0.151;
var CHEAPEST_SUBSCRIPTION_CREDIT_USD = 99 / 400;
var TTS_56_SECONDS_USD = 56 * 25 / 1e6 * 20;
var TEXT_AND_INPUT_ALLOWANCE_USD = 0.2;
function withVideoModel(model, run) {
  const previous = process.env.GEMINI_VIDEO_MODEL;
  if (model === void 0) delete process.env.GEMINI_VIDEO_MODEL;
  else process.env.GEMINI_VIDEO_MODEL = model;
  try {
    run();
  } finally {
    if (previous === void 0) delete process.env.GEMINI_VIDEO_MODEL;
    else process.env.GEMINI_VIDEO_MODEL = previous;
  }
}
test("the automatic Gemini model chain cannot silently fall back to margin-breaking Standard", () => {
  withVideoModel(void 0, () => assert.deepEqual(geminiModelChain(), ["veo-3.1-fast-generate-preview"]));
});
test("Fast 1080p and 4K charges cover provider cost by at least 2x at the cheapest subscription credit value", () => {
  withVideoModel(void 0, () => {
    for (const [quality, providerRate] of [["1080p", FAST_1080P_USD_PER_SEC], ["4k", FAST_4K_USD_PER_SEC]]) {
      const credits = videoCreditCost("video", true, 56, quality);
      const revenue = credits * CHEAPEST_SUBSCRIPTION_CREDIT_USD;
      const providerCost = 56 * providerRate;
      assert.ok(revenue >= providerCost * 2, `${quality}: $${revenue.toFixed(2)} revenue must cover 2x $${providerCost.toFixed(2)} provider cost`);
    }
  });
});
test("an explicitly pinned Standard model automatically charges conservative credits", () => {
  withVideoModel("veo-3.1-generate-preview", () => {
    const credits1080 = videoCreditCost("video", true, 8, "1080p");
    const credits4k = videoCreditCost("video", true, 8, "4k");
    assert.equal(credits1080, 8 * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P);
    assert.equal(credits4k, 8 * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K);
    assert.ok(credits1080 * CHEAPEST_SUBSCRIPTION_CREDIT_USD >= 8 * STANDARD_1080P_USD_PER_SEC * 2);
    assert.ok(credits4k * CHEAPEST_SUBSCRIPTION_CREDIT_USD >= 8 * STANDARD_4K_USD_PER_SEC * 2);
  });
});
test("every subscription remains above 2x Fast 1080p cost when all credits are used", () => {
  const plans = [PRODUCTS.creator, PRODUCTS.pro, PRODUCTS.agency];
  for (const plan of plans) {
    const providerCost = plan.credits * FAST_1080P_USD_PER_SEC;
    assert.ok(plan.amountUsd >= providerCost * 2, `$${plan.amountUsd} plan with ${plan.credits} credits must cover 2x $${providerCost.toFixed(2)}`);
  }
});
test("one-time 1080p video packs include narration credits and clear the 2x cost floor", () => {
  const packs = [
    { product: PRODUCTS.single8, seconds: 8 },
    { product: PRODUCTS.single30, seconds: 24 },
    { product: PRODUCTS.single60, seconds: 56 }
  ];
  withVideoModel(void 0, () => {
    for (const { product, seconds } of packs) {
      assert.equal(product.credits, videoCreditCost("video", false, seconds, "1080p"));
      const conservativeCost = seconds * FAST_1080P_USD_PER_SEC + TTS_56_SECONDS_USD + TEXT_AND_INPUT_ALLOWANCE_USD;
      assert.ok(product.amountUsd >= conservativeCost * 2, `$${product.amountUsd} pack must cover 2x $${conservativeCost.toFixed(2)}`);
    }
  });
});
test("photo sets and 100-credit top-ups clear the 2x provider-cost floor", () => {
  const photoRevenue = CREDIT_COSTS.PHOTO_SET_4 * CHEAPEST_SUBSCRIPTION_CREDIT_USD;
  const photoCost = IMAGE_4K_USD * 4 + TEXT_AND_INPUT_ALLOWANCE_USD;
  assert.ok(photoRevenue >= photoCost * 2);
  assert.ok(PRODUCTS.topup100.amountUsd >= PRODUCTS.topup100.credits * FAST_1080P_USD_PER_SEC * 2);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL2lwYWRkci5qc0AyLjQuMC9ub2RlX21vZHVsZXMvaXBhZGRyLmpzL2xpYi9pcGFkZHIuanMiLCAiLi4vc3JjL2xpYi9wb29sLnRzIiwgIi4uL3Rlc3QvcHJpY2luZy1tYXJnaW5zLnRlc3QudHMiLCAiLi4vc3JjL2xpYi9jcmVkaXRzLnRzIiwgIi4uL3NyYy9saWIvdmVvLnRzIiwgIi4uL3NyYy9saWIvY2FwdHVyZS50cyIsICIuLi9zcmMvbGliL3NzcmYudHMiLCAiLi4vc3JjL2xpYi9wcm92aWRlci1jb25maWcudHMiLCAiLi4vc3JjL2xpYi9zZWxmLWhvc3RlZC50cyIsICIuLi9zcmMvbGliL2Nvc3RzLnRzIiwgIi4uL3NyYy9yb3V0ZXMvcGF5cGFsLnRzIiwgIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS96b2RAMy4yNS43Ni9ub2RlX21vZHVsZXMvem9kL3YzL2V4dGVybmFsLmpzIiwgIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS96b2RAMy4yNS43Ni9ub2RlX21vZHVsZXMvem9kL3YzL2hlbHBlcnMvdXRpbC5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vem9kQDMuMjUuNzYvbm9kZV9tb2R1bGVzL3pvZC92My9ab2RFcnJvci5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vem9kQDMuMjUuNzYvbm9kZV9tb2R1bGVzL3pvZC92My9sb2NhbGVzL2VuLmpzIiwgIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS96b2RAMy4yNS43Ni9ub2RlX21vZHVsZXMvem9kL3YzL2Vycm9ycy5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vem9kQDMuMjUuNzYvbm9kZV9tb2R1bGVzL3pvZC92My9oZWxwZXJzL3BhcnNlVXRpbC5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vem9kQDMuMjUuNzYvbm9kZV9tb2R1bGVzL3pvZC92My9oZWxwZXJzL2Vycm9yVXRpbC5qcyIsICIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vem9kQDMuMjUuNzYvbm9kZV9tb2R1bGVzL3pvZC92My90eXBlcy5qcyIsICIuLi9zcmMvbGliL2F1dGgudHMiLCAiLi4vc3JjL2xpYi9maXJlYmFzZS1hZG1pbi50cyIsICIuLi9zcmMvbGliL3F1ZXJpZXMudHMiLCAiLi4vc3JjL2xpYi9lcnJvcnMudHMiLCAiLi4vc3JjL2xpYi9iaWxsaW5nLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIoZnVuY3Rpb24gKHJvb3QpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgLy8gQSBsaXN0IG9mIHJlZ3VsYXIgZXhwcmVzc2lvbnMgdGhhdCBtYXRjaCBhcmJpdHJhcnkgSVB2NCBhZGRyZXNzZXMsXG4gICAgLy8gZm9yIHdoaWNoIGEgbnVtYmVyIG9mIHdlaXJkIG5vdGF0aW9ucyBleGlzdC5cbiAgICAvLyBOb3RlIHRoYXQgYW4gYWRkcmVzcyBsaWtlIDAwMTAuMHhhNS4xLjEgaXMgY29uc2lkZXJlZCBsZWdhbC5cbiAgICBjb25zdCBpcHY0UGFydCA9ICcoMD9cXFxcZCt8MHhbYS1mMC05XSspJztcbiAgICBjb25zdCBpcHY0UmVnZXhlcyA9IHtcbiAgICAgICAgZm91ck9jdGV0OiBuZXcgUmVnRXhwKGBeJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH0kYCwgJ2knKSxcbiAgICAgICAgdGhyZWVPY3RldDogbmV3IFJlZ0V4cChgXiR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH0kYCwgJ2knKSxcbiAgICAgICAgdHdvT2N0ZXQ6IG5ldyBSZWdFeHAoYF4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH0kYCwgJ2knKSxcbiAgICAgICAgbG9uZ1ZhbHVlOiBuZXcgUmVnRXhwKGBeJHtpcHY0UGFydH0kYCwgJ2knKVxuICAgIH07XG5cbiAgICAvLyBSZWd1bGFyIEV4cHJlc3Npb24gZm9yIGNoZWNraW5nIE9jdGFsIG51bWJlcnNcbiAgICBjb25zdCBvY3RhbFJlZ2V4ID0gbmV3IFJlZ0V4cChgXjBbMC03XSskYCwgJ2knKTtcbiAgICBjb25zdCBoZXhSZWdleCA9IG5ldyBSZWdFeHAoYF4weFthLWYwLTldKyRgLCAnaScpO1xuXG4gICAgY29uc3Qgem9uZUluZGV4ID0gJyVbMC05YS16XXsxLH0nO1xuXG4gICAgLy8gSVB2Ni1tYXRjaGluZyByZWd1bGFyIGV4cHJlc3Npb25zLlxuICAgIC8vIEZvciBJUHY2LCB0aGUgdGFzayBpcyBzaW1wbGVyOiBpdCBpcyBlbm91Z2ggdG8gbWF0Y2ggdGhlIGNvbG9uLWRlbGltaXRlZFxuICAgIC8vIGhleGFkZWNpbWFsIElQdjYgYW5kIGEgdHJhbnNpdGlvbmFsIHZhcmlhbnQgd2l0aCBkb3R0ZWQtZGVjaW1hbCBJUHY0IGF0XG4gICAgLy8gdGhlIGVuZC5cbiAgICBjb25zdCBpcHY2UGFydCA9ICcoPzpbMC05YS1mXSs6Oj8pKyc7XG4gICAgY29uc3QgaXB2NlJlZ2V4ZXMgPSB7XG4gICAgICAgIHpvbmVJbmRleDogbmV3IFJlZ0V4cCh6b25lSW5kZXgsICdpJyksXG4gICAgICAgICduYXRpdmUnOiBuZXcgUmVnRXhwKGBeKDo6KT8oJHtpcHY2UGFydH0pPyhbMC05YS1mXSspPyg6Oik/KCR7em9uZUluZGV4fSk/JGAsICdpJyksXG4gICAgICAgIGRlcHJlY2F0ZWRUcmFuc2l0aW9uYWw6IG5ldyBSZWdFeHAoYF4oPzo6OikoJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH0oJHt6b25lSW5kZXh9KT8pJGAsICdpJyksXG4gICAgICAgIHRyYW5zaXRpb25hbDogbmV3IFJlZ0V4cChgXigoPzoke2lwdjZQYXJ0fSl8KD86OjopKD86JHtpcHY2UGFydH0pPykke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fSgke3pvbmVJbmRleH0pPyRgLCAnaScpXG4gICAgfTtcblxuICAgIC8vIEV4cGFuZCA6OiBpbiBhbiBJUHY2IGFkZHJlc3Mgb3IgYWRkcmVzcyBwYXJ0IGNvbnNpc3Rpbmcgb2YgYHBhcnRzYCBncm91cHMuXG4gICAgZnVuY3Rpb24gZXhwYW5kSVB2NiAoc3RyaW5nLCBwYXJ0cykge1xuICAgICAgICAvLyBNb3JlIHRoYW4gb25lICc6OicgbWVhbnMgaW52YWxpZCBhZGRyZXNzXG4gICAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignOjonKSAhPT0gc3RyaW5nLmxhc3RJbmRleE9mKCc6OicpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjb2xvbkNvdW50ID0gMDtcbiAgICAgICAgbGV0IGxhc3RDb2xvbiA9IC0xO1xuICAgICAgICBsZXQgem9uZUlkID0gKHN0cmluZy5tYXRjaChpcHY2UmVnZXhlcy56b25lSW5kZXgpIHx8IFtdKVswXTtcbiAgICAgICAgbGV0IHJlcGxhY2VtZW50LCByZXBsYWNlbWVudENvdW50O1xuXG4gICAgICAgIC8vIFJlbW92ZSB6b25lIGluZGV4IGFuZCBzYXZlIGl0IGZvciBsYXRlclxuICAgICAgICBpZiAoem9uZUlkKSB7XG4gICAgICAgICAgICB6b25lSWQgPSB6b25lSWQuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgc3RyaW5nID0gc3RyaW5nLnJlcGxhY2UoLyUuKyQvLCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIb3cgbWFueSBwYXJ0cyBkbyB3ZSBhbHJlYWR5IGhhdmU/XG4gICAgICAgIHdoaWxlICgobGFzdENvbG9uID0gc3RyaW5nLmluZGV4T2YoJzonLCBsYXN0Q29sb24gKyAxKSkgPj0gMCkge1xuICAgICAgICAgICAgY29sb25Db3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gMDo6MCBpcyB0d28gcGFydHMgbW9yZSB0aGFuIDo6XG4gICAgICAgIGlmIChzdHJpbmcuc3Vic3RyKDAsIDIpID09PSAnOjonKSB7XG4gICAgICAgICAgICBjb2xvbkNvdW50LS07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RyaW5nLnN1YnN0cigtMiwgMikgPT09ICc6OicpIHtcbiAgICAgICAgICAgIGNvbG9uQ291bnQtLTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgbG9vcCB3b3VsZCBoYW5nIGlmIGNvbG9uQ291bnQgPiBwYXJ0c1xuICAgICAgICBpZiAoY29sb25Db3VudCA+IHBhcnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlcGxhY2VtZW50ID0gJzonICsgJzA6JyAqIChwYXJ0cyAtIGNvbG9uQ291bnQpXG4gICAgICAgIHJlcGxhY2VtZW50Q291bnQgPSBwYXJ0cyAtIGNvbG9uQ291bnQ7XG4gICAgICAgIHJlcGxhY2VtZW50ID0gJzonO1xuICAgICAgICB3aGlsZSAocmVwbGFjZW1lbnRDb3VudC0tKSB7XG4gICAgICAgICAgICByZXBsYWNlbWVudCArPSAnMDonO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW5zZXJ0IHRoZSBtaXNzaW5nIHplcm9lc1xuICAgICAgICBzdHJpbmcgPSBzdHJpbmcucmVwbGFjZSgnOjonLCByZXBsYWNlbWVudCk7XG5cbiAgICAgICAgLy8gVHJpbSBhbnkgZ2FyYmFnZSB3aGljaCBtYXkgYmUgaGFuZ2luZyBhcm91bmQgaWYgOjogd2FzIGF0IHRoZSBlZGdlIGluXG4gICAgICAgIC8vIHRoZSBzb3VyY2Ugc3RyaW5nXG4gICAgICAgIGlmIChzdHJpbmdbMF0gPT09ICc6Jykge1xuICAgICAgICAgICAgc3RyaW5nID0gc3RyaW5nLnNsaWNlKDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0cmluZ1tzdHJpbmcubGVuZ3RoIC0gMV0gPT09ICc6Jykge1xuICAgICAgICAgICAgc3RyaW5nID0gc3RyaW5nLnNsaWNlKDAsIC0xKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHN0cmluZy5zcGxpdCgnOicpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChwYXJzZUludChyZWZbaV0sIDE2KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICB9KSgpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXJ0czogcGFydHMsXG4gICAgICAgICAgICB6b25lSWQ6IHpvbmVJZFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIEEgZ2VuZXJpYyBDSURSIChDbGFzc2xlc3MgSW50ZXItRG9tYWluIFJvdXRpbmcpIFJGQzE1MTggcmFuZ2UgbWF0Y2hlci5cbiAgICBmdW5jdGlvbiBtYXRjaENJRFIgKGZpcnN0LCBzZWNvbmQsIHBhcnRTaXplLCBjaWRyQml0cykge1xuICAgICAgICBpZiAoZmlyc3QubGVuZ3RoICE9PSBzZWNvbmQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogY2Fubm90IG1hdGNoIENJRFIgZm9yIG9iamVjdHMgd2l0aCBkaWZmZXJlbnQgbGVuZ3RocycpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHBhcnQgPSAwO1xuICAgICAgICBsZXQgc2hpZnQ7XG5cbiAgICAgICAgd2hpbGUgKGNpZHJCaXRzID4gMCkge1xuICAgICAgICAgICAgc2hpZnQgPSBwYXJ0U2l6ZSAtIGNpZHJCaXRzO1xuICAgICAgICAgICAgaWYgKHNoaWZ0IDwgMCkge1xuICAgICAgICAgICAgICAgIHNoaWZ0ID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZpcnN0W3BhcnRdID4+IHNoaWZ0ICE9PSBzZWNvbmRbcGFydF0gPj4gc2hpZnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNpZHJCaXRzIC09IHBhcnRTaXplO1xuICAgICAgICAgICAgcGFydCArPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VJbnRBdXRvIChzdHJpbmcpIHtcbiAgICAgICAgLy8gSGV4YWRlY2ltYWwgYmFzZSAxNiAoMHgjKVxuICAgICAgICBpZiAoaGV4UmVnZXgudGVzdChzdHJpbmcpKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoc3RyaW5nLCAxNik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2hpbGUgb2N0YWwgcmVwcmVzZW50YXRpb24gaXMgZGlzY291cmFnZWQgYnkgRUNNQVNjcmlwdCAzXG4gICAgICAgIC8vIGFuZCBmb3JiaWRkZW4gYnkgRUNNQVNjcmlwdCA1LCB3ZSBzaWxlbnRseSBhbGxvdyBpdCB0b1xuICAgICAgICAvLyB3b3JrIG9ubHkgaWYgdGhlIHJlc3Qgb2YgdGhlIHN0cmluZyBoYXMgbnVtYmVycyBsZXNzIHRoYW4gOC5cbiAgICAgICAgaWYgKHN0cmluZ1swXSA9PT0gJzAnICYmICFpc05hTihwYXJzZUludChzdHJpbmdbMV0sIDEwKSkpIHtcbiAgICAgICAgaWYgKG9jdGFsUmVnZXgudGVzdChzdHJpbmcpKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoc3RyaW5nLCA4KTtcbiAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpcGFkZHI6IGNhbm5vdCBwYXJzZSAke3N0cmluZ30gYXMgb2N0YWxgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBBbHdheXMgaW5jbHVkZSB0aGUgYmFzZSAxMCByYWRpeCFcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHN0cmluZywgMTApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhZFBhcnQgKHBhcnQsIGxlbmd0aCkge1xuICAgICAgICB3aGlsZSAocGFydC5sZW5ndGggPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIHBhcnQgPSBgMCR7cGFydH1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBhcnQ7XG4gICAgfVxuXG4gICAgY29uc3QgaXBhZGRyID0ge307XG5cbiAgICAvLyBBbiBJUHY0IGFkZHJlc3MgKFJGQzc5MSkuXG4gICAgaXBhZGRyLklQdjQgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBDb25zdHJ1Y3RzIGEgbmV3IElQdjQgYWRkcmVzcyBmcm9tIGFuIGFycmF5IG9mIGZvdXIgb2N0ZXRzXG4gICAgICAgIC8vIGluIG5ldHdvcmsgb3JkZXIgKE1TQiBmaXJzdClcbiAgICAgICAgLy8gVmVyaWZpZXMgdGhlIGlucHV0LlxuICAgICAgICBmdW5jdGlvbiBJUHY0IChvY3RldHMpIHtcbiAgICAgICAgICAgIGlmIChvY3RldHMubGVuZ3RoICE9PSA0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGlwdjQgb2N0ZXQgY291bnQgc2hvdWxkIGJlIDQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGksIG9jdGV0O1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2N0ZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgb2N0ZXQgPSBvY3RldHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCEoKDAgPD0gb2N0ZXQgJiYgb2N0ZXQgPD0gMjU1KSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGlwdjQgb2N0ZXQgc2hvdWxkIGZpdCBpbiA4IGJpdHMnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMub2N0ZXRzID0gb2N0ZXRzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BlY2lhbCBJUHY0IGFkZHJlc3MgcmFuZ2VzLlxuICAgICAgICAvLyBTZWUgYWxzbyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9SZXNlcnZlZF9JUF9hZGRyZXNzZXNcbiAgICAgICAgSVB2NC5wcm90b3R5cGUuU3BlY2lhbFJhbmdlcyA9IHtcbiAgICAgICAgICAgIHVuc3BlY2lmaWVkOiBbW25ldyBJUHY0KFswLCAwLCAwLCAwXSksIDhdXSxcbiAgICAgICAgICAgIGJyb2FkY2FzdDogW1tuZXcgSVB2NChbMjU1LCAyNTUsIDI1NSwgMjU1XSksIDMyXV0sXG4gICAgICAgICAgICAvLyBSRkMzMTcxXG4gICAgICAgICAgICBtdWx0aWNhc3Q6IFtbbmV3IElQdjQoWzIyNCwgMCwgMCwgMF0pLCA0XV0sXG4gICAgICAgICAgICAvLyBSRkMzOTI3XG4gICAgICAgICAgICBsaW5rTG9jYWw6IFtbbmV3IElQdjQoWzE2OSwgMjU0LCAwLCAwXSksIDE2XV0sXG4gICAgICAgICAgICAvLyBSRkM1NzM1XG4gICAgICAgICAgICBsb29wYmFjazogW1tuZXcgSVB2NChbMTI3LCAwLCAwLCAwXSksIDhdXSxcbiAgICAgICAgICAgIC8vIFJGQzY1OThcbiAgICAgICAgICAgIGNhcnJpZXJHcmFkZU5hdDogW1tuZXcgSVB2NChbMTAwLCA2NCwgMCwgMF0pLCAxMF1dLFxuICAgICAgICAgICAgLy8gUkZDMTkxOFxuICAgICAgICAgICAgJ3ByaXZhdGUnOiBbXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxMCwgMCwgMCwgMF0pLCA4XSxcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE3MiwgMTYsIDAsIDBdKSwgMTJdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTkyLCAxNjgsIDAsIDBdKSwgMTZdXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgLy8gUmVzZXJ2ZWQgYW5kIHRlc3Rpbmctb25seSByYW5nZXM7IFJGQ3MgNTczNSwgNTczNywgMjU0NCwgMTcwMFxuICAgICAgICAgICAgcmVzZXJ2ZWQ6IFtcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE5MiwgMCwgMCwgMF0pLCAyNF0sXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxOTIsIDAsIDIsIDBdKSwgMjRdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTkyLCA4OCwgOTksIDBdKSwgMjRdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTk4LCAxOCwgMCwgMF0pLCAxNV0sXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxOTgsIDUxLCAxMDAsIDBdKSwgMjRdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMjAzLCAwLCAxMTMsIDBdKSwgMjRdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMjQwLCAwLCAwLCAwXSksIDRdXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgLy8gUkZDNzUzNCwgUkZDNzUzNVxuICAgICAgICAgICAgYXMxMTI6IFtcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE5MiwgMTc1LCA0OCwgMF0pLCAyNF0sXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxOTIsIDMxLCAxOTYsIDBdKSwgMjRdLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIC8vIFJGQzc0NTBcbiAgICAgICAgICAgIGFtdDogW1xuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTkyLCA1MiwgMTkzLCAwXSksIDI0XSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlICdraW5kJyBtZXRob2QgZXhpc3RzIG9uIGJvdGggSVB2NCBhbmQgSVB2NiBjbGFzc2VzLlxuICAgICAgICBJUHY0LnByb3RvdHlwZS5raW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdpcHY0JztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDaGVja3MgaWYgdGhpcyBhZGRyZXNzIG1hdGNoZXMgb3RoZXIgb25lIHdpdGhpbiBnaXZlbiBDSURSIHJhbmdlLlxuICAgICAgICBJUHY0LnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIChvdGhlciwgY2lkclJhbmdlKSB7XG4gICAgICAgICAgICBsZXQgcmVmO1xuICAgICAgICAgICAgaWYgKGNpZHJSYW5nZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmVmID0gb3RoZXI7XG4gICAgICAgICAgICAgICAgb3RoZXIgPSByZWZbMF07XG4gICAgICAgICAgICAgICAgY2lkclJhbmdlID0gcmVmWzFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3RoZXIua2luZCgpICE9PSAnaXB2NCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogY2Fubm90IG1hdGNoIGlwdjQgYWRkcmVzcyB3aXRoIG5vbi1pcHY0IG9uZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hDSURSKHRoaXMub2N0ZXRzLCBvdGhlci5vY3RldHMsIDgsIGNpZHJSYW5nZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gcmV0dXJucyBhIG51bWJlciBvZiBsZWFkaW5nIG9uZXMgaW4gSVB2NCBhZGRyZXNzLCBtYWtpbmcgc3VyZSB0aGF0XG4gICAgICAgIC8vIHRoZSByZXN0IGlzIGEgc29saWQgc2VxdWVuY2Ugb2YgMCdzICh2YWxpZCBuZXRtYXNrKVxuICAgICAgICAvLyByZXR1cm5zIGVpdGhlciB0aGUgQ0lEUiBsZW5ndGggb3IgbnVsbCBpZiBtYXNrIGlzIG5vdCB2YWxpZFxuICAgICAgICBJUHY0LnByb3RvdHlwZS5wcmVmaXhMZW5ndGhGcm9tU3VibmV0TWFzayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxldCBjaWRyID0gMDtcbiAgICAgICAgICAgIC8vIG5vbi16ZXJvIGVuY291bnRlcmVkIHN0b3Agc2Nhbm5pbmcgZm9yIHplcm9lc1xuICAgICAgICAgICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICAgICAgICAgIC8vIG51bWJlciBvZiB6ZXJvZXMgaW4gb2N0ZXRcbiAgICAgICAgICAgIGNvbnN0IHplcm90YWJsZSA9IHtcbiAgICAgICAgICAgICAgICAwOiA4LFxuICAgICAgICAgICAgICAgIDEyODogNyxcbiAgICAgICAgICAgICAgICAxOTI6IDYsXG4gICAgICAgICAgICAgICAgMjI0OiA1LFxuICAgICAgICAgICAgICAgIDI0MDogNCxcbiAgICAgICAgICAgICAgICAyNDg6IDMsXG4gICAgICAgICAgICAgICAgMjUyOiAyLFxuICAgICAgICAgICAgICAgIDI1NDogMSxcbiAgICAgICAgICAgICAgICAyNTU6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBsZXQgaSwgb2N0ZXQsIHplcm9zO1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAzOyBpID49IDA7IGkgLT0gMSkge1xuICAgICAgICAgICAgICAgIG9jdGV0ID0gdGhpcy5vY3RldHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKG9jdGV0IGluIHplcm90YWJsZSkge1xuICAgICAgICAgICAgICAgICAgICB6ZXJvcyA9IHplcm90YWJsZVtvY3RldF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9wICYmIHplcm9zICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh6ZXJvcyAhPT0gOCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjaWRyICs9IHplcm9zO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIDMyIC0gY2lkcjtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDaGVja3MgaWYgdGhlIGFkZHJlc3MgY29ycmVzcG9uZHMgdG8gb25lIG9mIHRoZSBzcGVjaWFsIHJhbmdlcy5cbiAgICAgICAgSVB2NC5wcm90b3R5cGUucmFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gaXBhZGRyLnN1Ym5ldE1hdGNoKHRoaXMsIHRoaXMuU3BlY2lhbFJhbmdlcyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmV0dXJucyBhbiBhcnJheSBvZiBieXRlLXNpemVkIHZhbHVlcyBpbiBuZXR3b3JrIG9yZGVyIChNU0IgZmlyc3QpXG4gICAgICAgIElQdjQucHJvdG90eXBlLnRvQnl0ZUFycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMub2N0ZXRzLnNsaWNlKDApO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENvbnZlcnRzIHRoaXMgSVB2NCBhZGRyZXNzIHRvIGFuIElQdjQtbWFwcGVkIElQdjYgYWRkcmVzcy5cbiAgICAgICAgSVB2NC5wcm90b3R5cGUudG9JUHY0TWFwcGVkQWRkcmVzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBpcGFkZHIuSVB2Ni5wYXJzZShgOjpmZmZmOiR7dGhpcy50b1N0cmluZygpfWApO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN5bW1ldHJpY2FsIG1ldGhvZCBzdHJpY3RseSBmb3IgYWxpZ25pbmcgd2l0aCB0aGUgSVB2NiBtZXRob2RzLlxuICAgICAgICBJUHY0LnByb3RvdHlwZS50b05vcm1hbGl6ZWRTdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b1N0cmluZygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJldHVybnMgdGhlIGFkZHJlc3MgaW4gY29udmVuaWVudCwgZGVjaW1hbC1kb3R0ZWQgZm9ybWF0LlxuICAgICAgICBJUHY0LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9jdGV0cy5qb2luKCcuJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIElQdjQ7XG4gICAgfSkoKTtcblxuICAgIC8vIEEgdXRpbGl0eSBmdW5jdGlvbiB0byByZXR1cm4gYnJvYWRjYXN0IGFkZHJlc3MgZ2l2ZW4gdGhlIElQdjQgaW50ZXJmYWNlIGFuZCBwcmVmaXggbGVuZ3RoIGluIENJRFIgbm90YXRpb25cbiAgICBpcGFkZHIuSVB2NC5icm9hZGNhc3RBZGRyZXNzRnJvbUNJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpZHIgPSB0aGlzLnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICAgICAgY29uc3QgaXBJbnRlcmZhY2VPY3RldHMgPSBjaWRyWzBdLnRvQnl0ZUFycmF5KCk7XG4gICAgICAgICAgICBjb25zdCBzdWJuZXRNYXNrT2N0ZXRzID0gdGhpcy5zdWJuZXRNYXNrRnJvbVByZWZpeExlbmd0aChjaWRyWzFdKS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgY29uc3Qgb2N0ZXRzID0gW107XG4gICAgICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoaSA8IDQpIHtcbiAgICAgICAgICAgICAgICAvLyBCcm9hZGNhc3QgYWRkcmVzcyBpcyBiaXR3aXNlIE9SIGJldHdlZW4gaXAgaW50ZXJmYWNlIGFuZCBpbnZlcnRlZCBtYXNrXG4gICAgICAgICAgICAgICAgb2N0ZXRzLnB1c2gocGFyc2VJbnQoaXBJbnRlcmZhY2VPY3RldHNbaV0sIDEwKSB8IHBhcnNlSW50KHN1Ym5ldE1hc2tPY3RldHNbaV0sIDEwKSBeIDI1NSk7XG4gICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbmV3IHRoaXMob2N0ZXRzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHRoZSBhZGRyZXNzIGRvZXMgbm90IGhhdmUgSVB2NCBDSURSIGZvcm1hdCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENoZWNrcyBpZiBhIGdpdmVuIHN0cmluZyBpcyBmb3JtYXR0ZWQgbGlrZSBJUHY0IGFkZHJlc3MuXG4gICAgaXBhZGRyLklQdjQuaXNJUHY0ID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZXIoc3RyaW5nKSAhPT0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gc3RyaW5nIGlzIGEgdmFsaWQgSVB2NCBhZGRyZXNzLlxuICAgIGlwYWRkci5JUHY0LmlzVmFsaWQgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBuZXcgdGhpcyh0aGlzLnBhcnNlcihzdHJpbmcpKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gc3RyaW5nIGlzIGEgdmFsaWQgSVB2NCBhZGRyZXNzIGluIENJRFIgbm90YXRpb24uXG4gICAgaXBhZGRyLklQdjQuaXNWYWxpZENJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBDaGVja3MgaWYgYSBnaXZlbiBzdHJpbmcgaXMgYSBmdWxsIGZvdXItcGFydCBJUHY0IEFkZHJlc3MuXG4gICAgaXBhZGRyLklQdjQuaXNWYWxpZEZvdXJQYXJ0RGVjaW1hbCA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgaWYgKGlwYWRkci5JUHY0LmlzVmFsaWQoc3RyaW5nKSAmJiBzdHJpbmcubWF0Y2goL14oMHxbMS05XVxcZCopKFxcLigwfFsxLTldXFxkKikpezN9JC8pKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBDaGVja3MgaWYgYSBnaXZlbiBzdHJpbmcgaXMgYSBmdWxsIGZvdXItcGFydCBJUHY0IEFkZHJlc3Mgd2l0aCBDSURSIHByZWZpeC5cbiAgICBpcGFkZHIuSVB2NC5pc1ZhbGlkQ0lEUkZvdXJQYXJ0RGVjaW1hbCA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBzdHJpbmcubWF0Y2goL14oLispXFwvKFxcZCspJC8pO1xuXG4gICAgICAgIGlmICghaXBhZGRyLklQdjQuaXNWYWxpZENJRFIoc3RyaW5nKSB8fCAhbWF0Y2gpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpcGFkZHIuSVB2NC5pc1ZhbGlkRm91clBhcnREZWNpbWFsKG1hdGNoWzFdKTtcbiAgICB9O1xuXG4gICAgLy8gQSB1dGlsaXR5IGZ1bmN0aW9uIHRvIHJldHVybiBuZXR3b3JrIGFkZHJlc3MgZ2l2ZW4gdGhlIElQdjQgaW50ZXJmYWNlIGFuZCBwcmVmaXggbGVuZ3RoIGluIENJRFIgbm90YXRpb25cbiAgICBpcGFkZHIuSVB2NC5uZXR3b3JrQWRkcmVzc0Zyb21DSURSID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICBsZXQgY2lkciwgaSwgaXBJbnRlcmZhY2VPY3RldHMsIG9jdGV0cywgc3VibmV0TWFza09jdGV0cztcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY2lkciA9IHRoaXMucGFyc2VDSURSKHN0cmluZyk7XG4gICAgICAgICAgICBpcEludGVyZmFjZU9jdGV0cyA9IGNpZHJbMF0udG9CeXRlQXJyYXkoKTtcbiAgICAgICAgICAgIHN1Ym5ldE1hc2tPY3RldHMgPSB0aGlzLnN1Ym5ldE1hc2tGcm9tUHJlZml4TGVuZ3RoKGNpZHJbMV0pLnRvQnl0ZUFycmF5KCk7XG4gICAgICAgICAgICBvY3RldHMgPSBbXTtcbiAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKGkgPCA0KSB7XG4gICAgICAgICAgICAgICAgLy8gTmV0d29yayBhZGRyZXNzIGlzIGJpdHdpc2UgQU5EIGJldHdlZW4gaXAgaW50ZXJmYWNlIGFuZCBtYXNrXG4gICAgICAgICAgICAgICAgb2N0ZXRzLnB1c2gocGFyc2VJbnQoaXBJbnRlcmZhY2VPY3RldHNbaV0sIDEwKSAmIHBhcnNlSW50KHN1Ym5ldE1hc2tPY3RldHNbaV0sIDEwKSk7XG4gICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbmV3IHRoaXMob2N0ZXRzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHRoZSBhZGRyZXNzIGRvZXMgbm90IGhhdmUgSVB2NCBDSURSIGZvcm1hdCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIFRyaWVzIHRvIHBhcnNlIGFuZCB2YWxpZGF0ZSBhIHN0cmluZyB3aXRoIElQdjQgYWRkcmVzcy5cbiAgICAvLyBUaHJvd3MgYW4gZXJyb3IgaWYgaXQgZmFpbHMuXG4gICAgaXBhZGRyLklQdjQucGFyc2UgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHBhcnRzID0gdGhpcy5wYXJzZXIoc3RyaW5nKTtcblxuICAgICAgICBpZiAocGFydHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBzdHJpbmcgaXMgbm90IGZvcm1hdHRlZCBsaWtlIGFuIElQdjQgQWRkcmVzcycpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKHBhcnRzKTtcbiAgICB9O1xuXG4gICAgLy8gUGFyc2VzIHRoZSBzdHJpbmcgYXMgYW4gSVB2NCBBZGRyZXNzIHdpdGggQ0lEUiBOb3RhdGlvbi5cbiAgICBpcGFkZHIuSVB2NC5wYXJzZUNJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGxldCBtYXRjaDtcblxuICAgICAgICBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKC9eKC4rKVxcLyhcXGQrKSQvKSkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hc2tMZW5ndGggPSBwYXJzZUludChtYXRjaFsyXSk7XG4gICAgICAgICAgICBpZiAobWFza0xlbmd0aCA+PSAwICYmIG1hc2tMZW5ndGggPD0gMzIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBbdGhpcy5wYXJzZShtYXRjaFsxXSksIG1hc2tMZW5ndGhdO1xuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwYXJzZWQsICd0b1N0cmluZycsIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmpvaW4oJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogc3RyaW5nIGlzIG5vdCBmb3JtYXR0ZWQgbGlrZSBhbiBJUHY0IENJRFIgcmFuZ2UnKTtcbiAgICB9O1xuXG4gICAgLy8gQ2xhc3NmdWwgdmFyaWFudHMgKGxpa2UgYS5iLCB3aGVyZSBhIGlzIGFuIG9jdGV0LCBhbmQgYiBpcyBhIDI0LWJpdFxuICAgIC8vIHZhbHVlIHJlcHJlc2VudGluZyBsYXN0IHRocmVlIG9jdGV0czsgdGhpcyBjb3JyZXNwb25kcyB0byBhIGNsYXNzIENcbiAgICAvLyBhZGRyZXNzKSBhcmUgb21pdHRlZCBkdWUgdG8gY2xhc3NsZXNzIG5hdHVyZSBvZiBtb2Rlcm4gSW50ZXJuZXQuXG4gICAgaXBhZGRyLklQdjQucGFyc2VyID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICBsZXQgbWF0Y2gsIHBhcnQsIHZhbHVlO1xuXG4gICAgICAgIC8vIHBhcnNlSW50IHJlY29nbml6ZXMgYWxsIHRoYXQgb2N0YWwgJiBoZXhhZGVjaW1hbCB3ZWlyZG5lc3MgZm9yIHVzXG4gICAgICAgIGlmICgobWF0Y2ggPSBzdHJpbmcubWF0Y2goaXB2NFJlZ2V4ZXMuZm91ck9jdGV0KSkpIHtcbiAgICAgICAgICAgIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZiA9IG1hdGNoLnNsaWNlKDEsIDYpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcnQgPSByZWZbaV07XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChwYXJzZUludEF1dG8ocGFydCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgfSBlbHNlIGlmICgobWF0Y2ggPSBzdHJpbmcubWF0Y2goaXB2NFJlZ2V4ZXMubG9uZ1ZhbHVlKSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gcGFyc2VJbnRBdXRvKG1hdGNoWzFdKTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA+IDB4ZmZmZmZmZmYgfHwgdmFsdWUgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGFkZHJlc3Mgb3V0c2lkZSBkZWZpbmVkIHJhbmdlJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgICAgICAgICAgICAgbGV0IHNoaWZ0O1xuXG4gICAgICAgICAgICAgICAgZm9yIChzaGlmdCA9IDA7IHNoaWZ0IDw9IDI0OyBzaGlmdCArPSA4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCgodmFsdWUgPj4gc2hpZnQpICYgMHhmZik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgICB9KSgpKS5yZXZlcnNlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKGlwdjRSZWdleGVzLnR3b09jdGV0KSkpIHtcbiAgICAgICAgICAgIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZiA9IG1hdGNoLnNsaWNlKDEsIDQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHZhbHVlID0gcGFyc2VJbnRBdXRvKHJlZlsxXSk7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID4gMHhmZmZmZmYgfHwgdmFsdWUgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBhZGRyZXNzIG91dHNpZGUgZGVmaW5lZCByYW5nZScpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChwYXJzZUludEF1dG8ocmVmWzBdKSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKCh2YWx1ZSA+PiAxNikgJiAweGZmKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goKHZhbHVlID4+ICA4KSAmIDB4ZmYpO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCggdmFsdWUgICAgICAgICYgMHhmZik7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKGlwdjRSZWdleGVzLnRocmVlT2N0ZXQpKSkge1xuICAgICAgICAgICAgcmV0dXJuIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVmID0gbWF0Y2guc2xpY2UoMSwgNSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBwYXJzZUludEF1dG8ocmVmWzJdKTtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPiAweGZmZmYgfHwgdmFsdWUgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBhZGRyZXNzIG91dHNpZGUgZGVmaW5lZCByYW5nZScpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChwYXJzZUludEF1dG8ocmVmWzBdKSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHBhcnNlSW50QXV0byhyZWZbMV0pKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goKHZhbHVlID4+IDgpICYgMHhmZik7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKCB2YWx1ZSAgICAgICAmIDB4ZmYpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgICB9KSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQSB1dGlsaXR5IGZ1bmN0aW9uIHRvIHJldHVybiBzdWJuZXQgbWFzayBpbiBJUHY0IGZvcm1hdCBnaXZlbiB0aGUgcHJlZml4IGxlbmd0aFxuICAgIGlwYWRkci5JUHY0LnN1Ym5ldE1hc2tGcm9tUHJlZml4TGVuZ3RoID0gZnVuY3Rpb24gKHByZWZpeCkge1xuICAgICAgICBwcmVmaXggPSBwYXJzZUludChwcmVmaXgpO1xuICAgICAgICBpZiAocHJlZml4IDwgMCB8fCBwcmVmaXggPiAzMikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGludmFsaWQgSVB2NCBwcmVmaXggbGVuZ3RoJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvY3RldHMgPSBbMCwgMCwgMCwgMF07XG4gICAgICAgIGxldCBqID0gMDtcbiAgICAgICAgY29uc3QgZmlsbGVkT2N0ZXRDb3VudCA9IE1hdGguZmxvb3IocHJlZml4IC8gOCk7XG5cbiAgICAgICAgd2hpbGUgKGogPCBmaWxsZWRPY3RldENvdW50KSB7XG4gICAgICAgICAgICBvY3RldHNbal0gPSAyNTU7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmlsbGVkT2N0ZXRDb3VudCA8IDQpIHtcbiAgICAgICAgICAgIG9jdGV0c1tmaWxsZWRPY3RldENvdW50XSA9IE1hdGgucG93KDIsIHByZWZpeCAlIDgpIC0gMSA8PCA4IC0gKHByZWZpeCAlIDgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKG9jdGV0cyk7XG4gICAgfTtcblxuICAgIC8vIEFuIElQdjYgYWRkcmVzcyAoUkZDMjQ2MClcbiAgICBpcGFkZHIuSVB2NiA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIENvbnN0cnVjdHMgYW4gSVB2NiBhZGRyZXNzIGZyb20gYW4gYXJyYXkgb2YgZWlnaHQgMTYgLSBiaXQgcGFydHNcbiAgICAgICAgLy8gb3Igc2l4dGVlbiA4IC0gYml0IHBhcnRzIGluIG5ldHdvcmsgb3JkZXIoTVNCIGZpcnN0KS5cbiAgICAgICAgLy8gVGhyb3dzIGFuIGVycm9yIGlmIHRoZSBpbnB1dCBpcyBpbnZhbGlkLlxuICAgICAgICBmdW5jdGlvbiBJUHY2IChwYXJ0cywgem9uZUlkKSB7XG4gICAgICAgICAgICBsZXQgaSwgcGFydDtcblxuICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMTYpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnRzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8PSAxNDsgaSArPSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGFydHMucHVzaCgocGFydHNbaV0gPDwgOCkgfCBwYXJ0c1tpICsgMV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFydHMubGVuZ3RoID09PSA4KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0cyA9IHBhcnRzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogaXB2NiBwYXJ0IGNvdW50IHNob3VsZCBiZSA4IG9yIDE2Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcGFydCA9IHRoaXMucGFydHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCEoKDAgPD0gcGFydCAmJiBwYXJ0IDw9IDB4ZmZmZikpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBpcHY2IHBhcnQgc2hvdWxkIGZpdCBpbiAxNiBiaXRzJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoem9uZUlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy56b25lSWQgPSB6b25lSWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTcGVjaWFsIElQdjYgcmFuZ2VzXG4gICAgICAgIElQdjYucHJvdG90eXBlLlNwZWNpYWxSYW5nZXMgPSB7XG4gICAgICAgICAgICAvLyBSRkM0MjkxLCBoZXJlIGFuZCBhZnRlclxuICAgICAgICAgICAgdW5zcGVjaWZpZWQ6IFtuZXcgSVB2NihbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAxMjhdLFxuICAgICAgICAgICAgbGlua0xvY2FsOiBbbmV3IElQdjYoWzB4ZmU4MCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAxMF0sXG4gICAgICAgICAgICBtdWx0aWNhc3Q6IFtuZXcgSVB2NihbMHhmZjAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDhdLFxuICAgICAgICAgICAgbG9vcGJhY2s6IFtuZXcgSVB2NihbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMV0pLCAxMjhdLFxuICAgICAgICAgICAgdW5pcXVlTG9jYWw6IFtuZXcgSVB2NihbMHhmYzAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDddLFxuICAgICAgICAgICAgaXB2NE1hcHBlZDogW25ldyBJUHY2KFswLCAwLCAwLCAwLCAwLCAweGZmZmYsIDAsIDBdKSwgOTZdLFxuICAgICAgICAgICAgLy8gUkZDMzg3OVxuICAgICAgICAgICAgZGVwcmVjYXRlZFNpdGVMb2NhbDogW25ldyBJUHY2KFsweGZlYzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMTBdLFxuICAgICAgICAgICAgLy8gUkZDNjY2NlxuICAgICAgICAgICAgZGlzY2FyZDogW25ldyBJUHY2KFsweDEwMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCA2NF0sXG4gICAgICAgICAgICAvLyBSRkM2MTQ1XG4gICAgICAgICAgICByZmM2MTQ1OiBbbmV3IElQdjYoWzAsIDAsIDAsIDAsIDB4ZmZmZiwgMCwgMCwgMF0pLCA5Nl0sXG4gICAgICAgICAgICByZmM2MDUyOiBbXG4gICAgICAgICAgICAgICAgLy8gUkZDNjA1MlxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NihbMHg2NCwgMHhmZjliLCAwLCAwLCAwLCAwLCAwLCAwXSksIDk2XSxcbiAgICAgICAgICAgICAgICAvLyBSRkM4MjE1XG4gICAgICAgICAgICAgICAgW25ldyBJUHY2KFsweDY0LCAweGZmOWIsIDB4MSwgMCwgMCwgMCwgMCwgMF0pLCA0OF0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgLy8gUkZDMzA1NlxuICAgICAgICAgICAgJzZ0bzQnOiBbbmV3IElQdjYoWzB4MjAwMiwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAxNl0sXG4gICAgICAgICAgICAvLyBSRkM2MDUyLCBSRkM2MTQ2XG4gICAgICAgICAgICB0ZXJlZG86IFtuZXcgSVB2NihbMHgyMDAxLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDMyXSxcbiAgICAgICAgICAgIC8vIFJGQzUxODBcbiAgICAgICAgICAgIGJlbmNobWFya2luZzogW25ldyBJUHY2KFsweDIwMDEsIDB4MiwgMCwgMCwgMCwgMCwgMCwgMF0pLCA0OF0sXG4gICAgICAgICAgICAvLyBSRkM3NDUwXG4gICAgICAgICAgICBhbXQ6IFtuZXcgSVB2NihbMHgyMDAxLCAweDMsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMzJdLFxuICAgICAgICAgICAgYXMxMTJ2NjogW1xuICAgICAgICAgICAgICAgIC8vIFJGQzc1MzVcbiAgICAgICAgICAgICAgICBbbmV3IElQdjYoWzB4MjAwMSwgMHg0LCAweDExMiwgMCwgMCwgMCwgMCwgMF0pLCA0OF0sXG4gICAgICAgICAgICAgICAgLy8gUkZDNzUzNFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NihbMHgyNjIwLCAweDRmLCAweDgwMDAsIDAsIDAsIDAsIDAsIDBdKSwgNDhdLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIC8vIFJGQzQ4NDNcbiAgICAgICAgICAgIGRlcHJlY2F0ZWRPcmNoaWQ6IFtuZXcgSVB2NihbMHgyMDAxLCAweDEwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDI4XSxcbiAgICAgICAgICAgIC8vIFJGQzczNDNcbiAgICAgICAgICAgIG9yY2hpZDI6IFtuZXcgSVB2NihbMHgyMDAxLCAweDIwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDI4XSxcbiAgICAgICAgICAgIC8vIFJGQzkzNzRcbiAgICAgICAgICAgIGRyb25lUmVtb3RlSWRQcm90b2NvbEVudGl0eVRhZ3M6IFtuZXcgSVB2NihbMHgyMDAxLCAweDMwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDI4XSxcbiAgICAgICAgICAgIC8vIFJGQzk2MDJcbiAgICAgICAgICAgIHNlZ21lbnRSb3V0aW5nOiBbbmV3IElQdjYoWzB4NWYwMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAxNl0sXG4gICAgICAgICAgICByZXNlcnZlZDogW1xuICAgICAgICAgICAgICAgIC8vIFJGQzM4NDlcbiAgICAgICAgICAgICAgICBbbmV3IElQdjYoWzB4MjAwMSwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAyM10sXG4gICAgICAgICAgICAgICAgLy8gUkZDMjkyOFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NihbMHgyMDAxLCAweGRiOCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAzMl0sXG4gICAgICAgICAgICAgICAgLy8gUkZDOTYzN1xuICAgICAgICAgICAgICAgIFtuZXcgSVB2NihbMHgzZmZmLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDIwXSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ2hlY2tzIGlmIHRoaXMgYWRkcmVzcyBpcyBhbiBJUHY0LW1hcHBlZCBJUHY2IGFkZHJlc3MuXG4gICAgICAgIElQdjYucHJvdG90eXBlLmlzSVB2NE1hcHBlZEFkZHJlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yYW5nZSgpID09PSAnaXB2NE1hcHBlZCc7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlICdraW5kJyBtZXRob2QgZXhpc3RzIG9uIGJvdGggSVB2NCBhbmQgSVB2NiBjbGFzc2VzLlxuICAgICAgICBJUHY2LnByb3RvdHlwZS5raW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdpcHY2JztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDaGVja3MgaWYgdGhpcyBhZGRyZXNzIG1hdGNoZXMgb3RoZXIgb25lIHdpdGhpbiBnaXZlbiBDSURSIHJhbmdlLlxuICAgICAgICBJUHY2LnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIChvdGhlciwgY2lkclJhbmdlKSB7XG4gICAgICAgICAgICBsZXQgcmVmO1xuXG4gICAgICAgICAgICBpZiAoY2lkclJhbmdlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZWYgPSBvdGhlcjtcbiAgICAgICAgICAgICAgICBvdGhlciA9IHJlZlswXTtcbiAgICAgICAgICAgICAgICBjaWRyUmFuZ2UgPSByZWZbMV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvdGhlci5raW5kKCkgIT09ICdpcHY2Jykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBjYW5ub3QgbWF0Y2ggaXB2NiBhZGRyZXNzIHdpdGggbm9uLWlwdjYgb25lJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtYXRjaENJRFIodGhpcy5wYXJ0cywgb3RoZXIucGFydHMsIDE2LCBjaWRyUmFuZ2UpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHJldHVybnMgYSBudW1iZXIgb2YgbGVhZGluZyBvbmVzIGluIElQdjYgYWRkcmVzcywgbWFraW5nIHN1cmUgdGhhdFxuICAgICAgICAvLyB0aGUgcmVzdCBpcyBhIHNvbGlkIHNlcXVlbmNlIG9mIDAncyAodmFsaWQgbmV0bWFzaylcbiAgICAgICAgLy8gcmV0dXJucyBlaXRoZXIgdGhlIENJRFIgbGVuZ3RoIG9yIG51bGwgaWYgbWFzayBpcyBub3QgdmFsaWRcbiAgICAgICAgSVB2Ni5wcm90b3R5cGUucHJlZml4TGVuZ3RoRnJvbVN1Ym5ldE1hc2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBsZXQgY2lkciA9IDA7XG4gICAgICAgICAgICAvLyBub24temVybyBlbmNvdW50ZXJlZCBzdG9wIHNjYW5uaW5nIGZvciB6ZXJvZXNcbiAgICAgICAgICAgIGxldCBzdG9wID0gZmFsc2U7XG4gICAgICAgICAgICAvLyBudW1iZXIgb2YgemVyb2VzIGluIG9jdGV0XG4gICAgICAgICAgICBjb25zdCB6ZXJvdGFibGUgPSB7XG4gICAgICAgICAgICAgICAgMDogMTYsXG4gICAgICAgICAgICAgICAgMzI3Njg6IDE1LFxuICAgICAgICAgICAgICAgIDQ5MTUyOiAxNCxcbiAgICAgICAgICAgICAgICA1NzM0NDogMTMsXG4gICAgICAgICAgICAgICAgNjE0NDA6IDEyLFxuICAgICAgICAgICAgICAgIDYzNDg4OiAxMSxcbiAgICAgICAgICAgICAgICA2NDUxMjogMTAsXG4gICAgICAgICAgICAgICAgNjUwMjQ6IDksXG4gICAgICAgICAgICAgICAgNjUyODA6IDgsXG4gICAgICAgICAgICAgICAgNjU0MDg6IDcsXG4gICAgICAgICAgICAgICAgNjU0NzI6IDYsXG4gICAgICAgICAgICAgICAgNjU1MDQ6IDUsXG4gICAgICAgICAgICAgICAgNjU1MjA6IDQsXG4gICAgICAgICAgICAgICAgNjU1Mjg6IDMsXG4gICAgICAgICAgICAgICAgNjU1MzI6IDIsXG4gICAgICAgICAgICAgICAgNjU1MzQ6IDEsXG4gICAgICAgICAgICAgICAgNjU1MzU6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBsZXQgcGFydCwgemVyb3M7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSA3OyBpID49IDA7IGkgLT0gMSkge1xuICAgICAgICAgICAgICAgIHBhcnQgPSB0aGlzLnBhcnRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChwYXJ0IGluIHplcm90YWJsZSkge1xuICAgICAgICAgICAgICAgICAgICB6ZXJvcyA9IHplcm90YWJsZVtwYXJ0XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0b3AgJiYgemVyb3MgIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHplcm9zICE9PSAxNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjaWRyICs9IHplcm9zO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIDEyOCAtIGNpZHI7XG4gICAgICAgIH07XG5cblxuICAgICAgICAvLyBDaGVja3MgaWYgdGhlIGFkZHJlc3MgY29ycmVzcG9uZHMgdG8gb25lIG9mIHRoZSBzcGVjaWFsIHJhbmdlcy5cbiAgICAgICAgSVB2Ni5wcm90b3R5cGUucmFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gaXBhZGRyLnN1Ym5ldE1hdGNoKHRoaXMsIHRoaXMuU3BlY2lhbFJhbmdlcyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmV0dXJucyBhbiBhcnJheSBvZiBieXRlLXNpemVkIHZhbHVlcyBpbiBuZXR3b3JrIG9yZGVyIChNU0IgZmlyc3QpXG4gICAgICAgIElQdjYucHJvdG90eXBlLnRvQnl0ZUFycmF5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbGV0IHBhcnQ7XG4gICAgICAgICAgICBjb25zdCBieXRlcyA9IFtdO1xuICAgICAgICAgICAgY29uc3QgcmVmID0gdGhpcy5wYXJ0cztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcGFydCA9IHJlZltpXTtcbiAgICAgICAgICAgICAgICBieXRlcy5wdXNoKHBhcnQgPj4gOCk7XG4gICAgICAgICAgICAgICAgYnl0ZXMucHVzaChwYXJ0ICYgMHhmZik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBieXRlcztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXR1cm5zIHRoZSBhZGRyZXNzIGluIGV4cGFuZGVkIGZvcm1hdCB3aXRoIGFsbCB6ZXJvZXMgaW5jbHVkZWQsIGxpa2VcbiAgICAgICAgLy8gMjAwMTowZGI4OjAwMDg6MDA2NjowMDAwOjAwMDA6MDAwMDowMDAxXG4gICAgICAgIElQdjYucHJvdG90eXBlLnRvRml4ZWRMZW5ndGhTdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zdCBhZGRyID0gKChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocGFkUGFydCh0aGlzLnBhcnRzW2ldLnRvU3RyaW5nKDE2KSwgNCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgICAgfSkuY2FsbCh0aGlzKSkuam9pbignOicpO1xuXG4gICAgICAgICAgICBsZXQgc3VmZml4ID0gJyc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnpvbmVJZCkge1xuICAgICAgICAgICAgICAgIHN1ZmZpeCA9IGAlJHt0aGlzLnpvbmVJZH1gO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYWRkciArIHN1ZmZpeDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDb252ZXJ0cyB0aGlzIGFkZHJlc3MgdG8gSVB2NCBhZGRyZXNzIGlmIGl0IGlzIGFuIElQdjQtbWFwcGVkIElQdjYgYWRkcmVzcy5cbiAgICAgICAgLy8gVGhyb3dzIGFuIGVycm9yIG90aGVyd2lzZS5cbiAgICAgICAgSVB2Ni5wcm90b3R5cGUudG9JUHY0QWRkcmVzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5pc0lQdjRNYXBwZWRBZGRyZXNzKCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogdHJ5aW5nIHRvIGNvbnZlcnQgYSBnZW5lcmljIGlwdjYgYWRkcmVzcyB0byBpcHY0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHRoaXMucGFydHMuc2xpY2UoLTIpO1xuICAgICAgICAgICAgY29uc3QgaGlnaCA9IHJlZlswXTtcbiAgICAgICAgICAgIGNvbnN0IGxvdyA9IHJlZlsxXTtcblxuICAgICAgICAgICAgcmV0dXJuIG5ldyBpcGFkZHIuSVB2NChbaGlnaCA+PiA4LCBoaWdoICYgMHhmZiwgbG93ID4+IDgsIGxvdyAmIDB4ZmZdKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXR1cm5zIHRoZSBhZGRyZXNzIGluIGV4cGFuZGVkIGZvcm1hdCB3aXRoIGFsbCB6ZXJvZXMgaW5jbHVkZWQsIGxpa2VcbiAgICAgICAgLy8gMjAwMTpkYjg6ODo2NjowOjA6MDoxXG4gICAgICAgIC8vXG4gICAgICAgIC8vIERlcHJlY2F0ZWQ6IHVzZSB0b0ZpeGVkTGVuZ3RoU3RyaW5nKCkgaW5zdGVhZC5cbiAgICAgICAgSVB2Ni5wcm90b3R5cGUudG9Ob3JtYWxpemVkU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc3QgYWRkciA9ICgoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2godGhpcy5wYXJ0c1tpXS50b1N0cmluZygxNikpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgICAgfSkuY2FsbCh0aGlzKSkuam9pbignOicpO1xuXG4gICAgICAgICAgICBsZXQgc3VmZml4ID0gJyc7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnpvbmVJZCkge1xuICAgICAgICAgICAgICAgIHN1ZmZpeCA9IGAlJHt0aGlzLnpvbmVJZH1gO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYWRkciArIHN1ZmZpeDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXR1cm5zIHRoZSBhZGRyZXNzIGluIGNvbXBhY3QsIGh1bWFuLXJlYWRhYmxlIGZvcm1hdCBsaWtlXG4gICAgICAgIC8vIDIwMDE6ZGI4Ojg6NjY6OjFcbiAgICAgICAgLy8gaW4gbGluZSB3aXRoIFJGQyA1OTUyIChzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzU5NTIjc2VjdGlvbi00KVxuICAgICAgICBJUHY2LnByb3RvdHlwZS50b1JGQzU5NTJTdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zdCByZWdleCA9IC8oKF58OikoMCg6fCQpKXsyLH0pL2c7XG4gICAgICAgICAgICBjb25zdCBzdHJpbmcgPSB0aGlzLnRvTm9ybWFsaXplZFN0cmluZygpO1xuICAgICAgICAgICAgbGV0IGJlc3RNYXRjaEluZGV4ID0gMDtcbiAgICAgICAgICAgIGxldCBiZXN0TWF0Y2hMZW5ndGggPSAtMTtcbiAgICAgICAgICAgIGxldCBtYXRjaDtcblxuICAgICAgICAgICAgd2hpbGUgKChtYXRjaCA9IHJlZ2V4LmV4ZWMoc3RyaW5nKSkpIHtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hbMF0ubGVuZ3RoID4gYmVzdE1hdGNoTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJlc3RNYXRjaEluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGJlc3RNYXRjaExlbmd0aCA9IG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChiZXN0TWF0Y2hMZW5ndGggPCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0cmluZztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGAke3N0cmluZy5zdWJzdHJpbmcoMCwgYmVzdE1hdGNoSW5kZXgpfTo6JHtzdHJpbmcuc3Vic3RyaW5nKGJlc3RNYXRjaEluZGV4ICsgYmVzdE1hdGNoTGVuZ3RoKX1gO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJldHVybnMgdGhlIGFkZHJlc3MgaW4gY29tcGFjdCwgaHVtYW4tcmVhZGFibGUgZm9ybWF0IGxpa2VcbiAgICAgICAgLy8gMjAwMTpkYjg6ODo2Njo6MVxuICAgICAgICAvLyBDYWxscyB0b1JGQzU5NTJTdHJpbmcgdW5kZXIgdGhlIGhvb2QuXG4gICAgICAgIElQdjYucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9SRkM1OTUyU3RyaW5nKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIElQdjY7XG5cbiAgICB9KSgpO1xuXG4gICAgLy8gQSB1dGlsaXR5IGZ1bmN0aW9uIHRvIHJldHVybiBicm9hZGNhc3QgYWRkcmVzcyBnaXZlbiB0aGUgSVB2NiBpbnRlcmZhY2UgYW5kIHByZWZpeCBsZW5ndGggaW4gQ0lEUiBub3RhdGlvblxuICAgIGlwYWRkci5JUHY2LmJyb2FkY2FzdEFkZHJlc3NGcm9tQ0lEUiA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpZHIgPSB0aGlzLnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICAgICAgY29uc3QgaXBJbnRlcmZhY2VPY3RldHMgPSBjaWRyWzBdLnRvQnl0ZUFycmF5KCk7XG4gICAgICAgICAgICBjb25zdCBzdWJuZXRNYXNrT2N0ZXRzID0gdGhpcy5zdWJuZXRNYXNrRnJvbVByZWZpeExlbmd0aChjaWRyWzFdKS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgY29uc3Qgb2N0ZXRzID0gW107XG4gICAgICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoaSA8IDE2KSB7XG4gICAgICAgICAgICAgICAgLy8gQnJvYWRjYXN0IGFkZHJlc3MgaXMgYml0d2lzZSBPUiBiZXR3ZWVuIGlwIGludGVyZmFjZSBhbmQgaW52ZXJ0ZWQgbWFza1xuICAgICAgICAgICAgICAgIG9jdGV0cy5wdXNoKHBhcnNlSW50KGlwSW50ZXJmYWNlT2N0ZXRzW2ldLCAxMCkgfCBwYXJzZUludChzdWJuZXRNYXNrT2N0ZXRzW2ldLCAxMCkgXiAyNTUpO1xuICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG5ldyB0aGlzKG9jdGV0cyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaXBhZGRyOiB0aGUgYWRkcmVzcyBkb2VzIG5vdCBoYXZlIElQdjYgQ0lEUiBmb3JtYXQgKCR7ZX0pYCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gc3RyaW5nIGlzIGZvcm1hdHRlZCBsaWtlIElQdjYgYWRkcmVzcy5cbiAgICBpcGFkZHIuSVB2Ni5pc0lQdjYgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlcihzdHJpbmcpICE9PSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBDaGVja3MgdG8gc2VlIGlmIHN0cmluZyBpcyBhIHZhbGlkIElQdjYgQWRkcmVzc1xuICAgIGlwYWRkci5JUHY2LmlzVmFsaWQgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG5cbiAgICAgICAgLy8gU2luY2UgSVB2Ni5pc1ZhbGlkIGlzIGFsd2F5cyBjYWxsZWQgZmlyc3QsIHRoaXMgc2hvcnRjdXRcbiAgICAgICAgLy8gcHJvdmlkZXMgYSBzdWJzdGFudGlhbCBwZXJmb3JtYW5jZSBnYWluLlxuICAgICAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycgJiYgc3RyaW5nLmluZGV4T2YoJzonKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhZGRyID0gdGhpcy5wYXJzZXIoc3RyaW5nKTtcbiAgICAgICAgICAgIG5ldyB0aGlzKGFkZHIucGFydHMsIGFkZHIuem9uZUlkKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gc3RyaW5nIGlzIGEgdmFsaWQgSVB2NiBhZGRyZXNzIGluIENJRFIgbm90YXRpb24uXG4gICAgaXBhZGRyLklQdjYuaXNWYWxpZENJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG5cbiAgICAgICAgLy8gU2VlIG5vdGUgaW4gSVB2Ni5pc1ZhbGlkXG4gICAgICAgIGlmICh0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJyAmJiBzdHJpbmcuaW5kZXhPZignOicpID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMucGFyc2VDSURSKHN0cmluZyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIEEgdXRpbGl0eSBmdW5jdGlvbiB0byByZXR1cm4gbmV0d29yayBhZGRyZXNzIGdpdmVuIHRoZSBJUHY2IGludGVyZmFjZSBhbmQgcHJlZml4IGxlbmd0aCBpbiBDSURSIG5vdGF0aW9uXG4gICAgaXBhZGRyLklQdjYubmV0d29ya0FkZHJlc3NGcm9tQ0lEUiA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgbGV0IGNpZHIsIGksIGlwSW50ZXJmYWNlT2N0ZXRzLCBvY3RldHMsIHN1Ym5ldE1hc2tPY3RldHM7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNpZHIgPSB0aGlzLnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICAgICAgaXBJbnRlcmZhY2VPY3RldHMgPSBjaWRyWzBdLnRvQnl0ZUFycmF5KCk7XG4gICAgICAgICAgICBzdWJuZXRNYXNrT2N0ZXRzID0gdGhpcy5zdWJuZXRNYXNrRnJvbVByZWZpeExlbmd0aChjaWRyWzFdKS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgb2N0ZXRzID0gW107XG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlIChpIDwgMTYpIHtcbiAgICAgICAgICAgICAgICAvLyBOZXR3b3JrIGFkZHJlc3MgaXMgYml0d2lzZSBBTkQgYmV0d2VlbiBpcCBpbnRlcmZhY2UgYW5kIG1hc2tcbiAgICAgICAgICAgICAgICBvY3RldHMucHVzaChwYXJzZUludChpcEludGVyZmFjZU9jdGV0c1tpXSwgMTApICYgcGFyc2VJbnQoc3VibmV0TWFza09jdGV0c1tpXSwgMTApKTtcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBuZXcgdGhpcyhvY3RldHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlwYWRkcjogdGhlIGFkZHJlc3MgZG9lcyBub3QgaGF2ZSBJUHY2IENJRFIgZm9ybWF0ICgke2V9KWApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIFRyaWVzIHRvIHBhcnNlIGFuZCB2YWxpZGF0ZSBhIHN0cmluZyB3aXRoIElQdjYgYWRkcmVzcy5cbiAgICAvLyBUaHJvd3MgYW4gZXJyb3IgaWYgaXQgZmFpbHMuXG4gICAgaXBhZGRyLklQdjYucGFyc2UgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGFkZHIgPSB0aGlzLnBhcnNlcihzdHJpbmcpO1xuXG4gICAgICAgIGlmIChhZGRyLnBhcnRzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogc3RyaW5nIGlzIG5vdCBmb3JtYXR0ZWQgbGlrZSBhbiBJUHY2IEFkZHJlc3MnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgdGhpcyhhZGRyLnBhcnRzLCBhZGRyLnpvbmVJZCk7XG4gICAgfTtcblxuICAgIGlwYWRkci5JUHY2LnBhcnNlQ0lEUiA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgbGV0IG1hc2tMZW5ndGgsIG1hdGNoLCBwYXJzZWQ7XG5cbiAgICAgICAgaWYgKChtYXRjaCA9IHN0cmluZy5tYXRjaCgvXiguKylcXC8oXFxkKykkLykpKSB7XG4gICAgICAgICAgICBtYXNrTGVuZ3RoID0gcGFyc2VJbnQobWF0Y2hbMl0pO1xuICAgICAgICAgICAgaWYgKG1hc2tMZW5ndGggPj0gMCAmJiBtYXNrTGVuZ3RoIDw9IDEyOCkge1xuICAgICAgICAgICAgICAgIHBhcnNlZCA9IFt0aGlzLnBhcnNlKG1hdGNoWzFdKSwgbWFza0xlbmd0aF07XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHBhcnNlZCwgJ3RvU3RyaW5nJywge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuam9pbignLycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBzdHJpbmcgaXMgbm90IGZvcm1hdHRlZCBsaWtlIGFuIElQdjYgQ0lEUiByYW5nZScpO1xuICAgIH07XG5cbiAgICAvLyBQYXJzZSBhbiBJUHY2IGFkZHJlc3MuXG4gICAgaXBhZGRyLklQdjYucGFyc2VyID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICBsZXQgYWRkciwgaSwgbWF0Y2gsIG9jdGV0LCBvY3RldHMsIHpvbmVJZDtcblxuICAgICAgICBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKGlwdjZSZWdleGVzLmRlcHJlY2F0ZWRUcmFuc2l0aW9uYWwpKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VyKGA6OmZmZmY6JHttYXRjaFsxXX1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXB2NlJlZ2V4ZXMubmF0aXZlLnRlc3Qoc3RyaW5nKSkge1xuICAgICAgICAgICAgcmV0dXJuIGV4cGFuZElQdjYoc3RyaW5nLCA4KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKGlwdjZSZWdleGVzLnRyYW5zaXRpb25hbCkpKSB7XG4gICAgICAgICAgICB6b25lSWQgPSBtYXRjaFs2XSB8fCAnJztcbiAgICAgICAgICAgIGFkZHIgPSBtYXRjaFsxXVxuICAgICAgICAgICAgaWYgKCFtYXRjaFsxXS5lbmRzV2l0aCgnOjonKSkge1xuICAgICAgICAgICAgICAgIGFkZHIgPSBhZGRyLnNsaWNlKDAsIC0xKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWRkciA9IGV4cGFuZElQdjYoYWRkciArIHpvbmVJZCwgNik7XG4gICAgICAgICAgICBpZiAoYWRkci5wYXJ0cykge1xuICAgICAgICAgICAgICAgIG9jdGV0cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VJbnQobWF0Y2hbMl0pLFxuICAgICAgICAgICAgICAgICAgICBwYXJzZUludChtYXRjaFszXSksXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KG1hdGNoWzRdKSxcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VJbnQobWF0Y2hbNV0pXG4gICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2N0ZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG9jdGV0ID0gb2N0ZXRzW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoISgoMCA8PSBvY3RldCAmJiBvY3RldCA8PSAyNTUpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhZGRyLnBhcnRzLnB1c2gob2N0ZXRzWzBdIDw8IDggfCBvY3RldHNbMV0pO1xuICAgICAgICAgICAgICAgIGFkZHIucGFydHMucHVzaChvY3RldHNbMl0gPDwgOCB8IG9jdGV0c1szXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcGFydHM6IGFkZHIucGFydHMsXG4gICAgICAgICAgICAgICAgICAgIHpvbmVJZDogYWRkci56b25lSWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIC8vIEEgdXRpbGl0eSBmdW5jdGlvbiB0byByZXR1cm4gc3VibmV0IG1hc2sgaW4gSVB2NiBmb3JtYXQgZ2l2ZW4gdGhlIHByZWZpeCBsZW5ndGhcbiAgICBpcGFkZHIuSVB2Ni5zdWJuZXRNYXNrRnJvbVByZWZpeExlbmd0aCA9IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgcHJlZml4ID0gcGFyc2VJbnQocHJlZml4KTtcbiAgICAgICAgaWYgKHByZWZpeCA8IDAgfHwgcHJlZml4ID4gMTI4KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogaW52YWxpZCBJUHY2IHByZWZpeCBsZW5ndGgnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9jdGV0cyA9IFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXTtcbiAgICAgICAgbGV0IGogPSAwO1xuICAgICAgICBjb25zdCBmaWxsZWRPY3RldENvdW50ID0gTWF0aC5mbG9vcihwcmVmaXggLyA4KTtcblxuICAgICAgICB3aGlsZSAoaiA8IGZpbGxlZE9jdGV0Q291bnQpIHtcbiAgICAgICAgICAgIG9jdGV0c1tqXSA9IDI1NTtcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWxsZWRPY3RldENvdW50IDwgMTYpIHtcbiAgICAgICAgICAgIG9jdGV0c1tmaWxsZWRPY3RldENvdW50XSA9IE1hdGgucG93KDIsIHByZWZpeCAlIDgpIC0gMSA8PCA4IC0gKHByZWZpeCAlIDgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzKG9jdGV0cyk7XG4gICAgfTtcblxuICAgIC8vIFRyeSB0byBwYXJzZSBhbiBhcnJheSBpbiBuZXR3b3JrIG9yZGVyIChNU0IgZmlyc3QpIGZvciBJUHY0IGFuZCBJUHY2XG4gICAgaXBhZGRyLmZyb21CeXRlQXJyYXkgPSBmdW5jdGlvbiAoYnl0ZXMpIHtcbiAgICAgICAgY29uc3QgbGVuZ3RoID0gYnl0ZXMubGVuZ3RoO1xuXG4gICAgICAgIGlmIChsZW5ndGggPT09IDQpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgaXBhZGRyLklQdjQoYnl0ZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gMTYpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgaXBhZGRyLklQdjYoYnl0ZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHRoZSBiaW5hcnkgaW5wdXQgaXMgbmVpdGhlciBhbiBJUHY2IG5vciBJUHY0IGFkZHJlc3MnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBDaGVja3MgaWYgdGhlIGFkZHJlc3MgaXMgdmFsaWQgSVAgYWRkcmVzc1xuICAgIGlwYWRkci5pc1ZhbGlkID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICByZXR1cm4gaXBhZGRyLklQdjYuaXNWYWxpZChzdHJpbmcpIHx8IGlwYWRkci5JUHY0LmlzVmFsaWQoc3RyaW5nKTtcbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIHRoZSBhZGRyZXNzIGlzIHZhbGlkIElQIGFkZHJlc3MgaW4gQ0lEUiBub3RhdGlvblxuICAgIGlwYWRkci5pc1ZhbGlkQ0lEUiA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGlwYWRkci5JUHY2LmlzVmFsaWRDSURSKHN0cmluZykgfHwgaXBhZGRyLklQdjQuaXNWYWxpZENJRFIoc3RyaW5nKTtcbiAgICB9O1xuXG5cbiAgICAvLyBBdHRlbXB0cyB0byBwYXJzZSBhbiBJUCBBZGRyZXNzLCBmaXJzdCB0aHJvdWdoIElQdjYgdGhlbiBJUHY0LlxuICAgIC8vIFRocm93cyBhbiBlcnJvciBpZiBpdCBjb3VsZCBub3QgYmUgcGFyc2VkLlxuICAgIGlwYWRkci5wYXJzZSA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgaWYgKGlwYWRkci5JUHY2LmlzVmFsaWQoc3RyaW5nKSkge1xuICAgICAgICAgICAgcmV0dXJuIGlwYWRkci5JUHY2LnBhcnNlKHN0cmluZyk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXBhZGRyLklQdjQuaXNWYWxpZChzdHJpbmcpKSB7XG4gICAgICAgICAgICByZXR1cm4gaXBhZGRyLklQdjQucGFyc2Uoc3RyaW5nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiB0aGUgYWRkcmVzcyBoYXMgbmVpdGhlciBJUHY2IG5vciBJUHY0IGZvcm1hdCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIEF0dGVtcHQgdG8gcGFyc2UgQ0lEUiBub3RhdGlvbiwgZmlyc3QgdGhyb3VnaCBJUHY2IHRoZW4gSVB2NC5cbiAgICAvLyBUaHJvd3MgYW4gZXJyb3IgaWYgaXQgY291bGQgbm90IGJlIHBhcnNlZC5cbiAgICBpcGFkZHIucGFyc2VDSURSID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGlwYWRkci5JUHY2LnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpcGFkZHIuSVB2NC5wYXJzZUNJRFIoc3RyaW5nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUyKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHRoZSBhZGRyZXNzIGhhcyBuZWl0aGVyIElQdjYgbm9yIElQdjQgQ0lEUiBmb3JtYXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBQYXJzZSBhbiBhZGRyZXNzIGFuZCByZXR1cm4gcGxhaW4gSVB2NCBhZGRyZXNzIGlmIGl0IGlzIGFuIElQdjQtbWFwcGVkIGFkZHJlc3NcbiAgICBpcGFkZHIucHJvY2VzcyA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgYWRkciA9IHRoaXMucGFyc2Uoc3RyaW5nKTtcblxuICAgICAgICBpZiAoYWRkci5raW5kKCkgPT09ICdpcHY2JyAmJiBhZGRyLmlzSVB2NE1hcHBlZEFkZHJlc3MoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZHIudG9JUHY0QWRkcmVzcygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGFkZHI7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQW4gdXRpbGl0eSBmdW5jdGlvbiB0byBlYXNlIG5hbWVkIHJhbmdlIG1hdGNoaW5nLiBTZWUgZXhhbXBsZXMgYmVsb3cuXG4gICAgLy8gcmFuZ2VMaXN0IGNhbiBjb250YWluIGJvdGggSVB2NCBhbmQgSVB2NiBzdWJuZXQgZW50cmllcyBhbmQgd2lsbCBub3QgdGhyb3cgZXJyb3JzXG4gICAgLy8gb24gbWF0Y2hpbmcgSVB2NCBhZGRyZXNzZXMgdG8gSVB2NiByYW5nZXMgb3IgdmljZSB2ZXJzYS5cbiAgICBpcGFkZHIuc3VibmV0TWF0Y2ggPSBmdW5jdGlvbiAoYWRkcmVzcywgcmFuZ2VMaXN0LCBkZWZhdWx0TmFtZSkge1xuICAgICAgICBsZXQgaSwgcmFuZ2VOYW1lLCByYW5nZVN1Ym5ldHMsIHN1Ym5ldDtcblxuICAgICAgICBpZiAoZGVmYXVsdE5hbWUgPT09IHVuZGVmaW5lZCB8fCBkZWZhdWx0TmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZGVmYXVsdE5hbWUgPSAndW5pY2FzdCc7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHJhbmdlTmFtZSBpbiByYW5nZUxpc3QpIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocmFuZ2VMaXN0LCByYW5nZU5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmFuZ2VTdWJuZXRzID0gcmFuZ2VMaXN0W3JhbmdlTmFtZV07XG4gICAgICAgICAgICAgICAgLy8gRUNNQTUgQXJyYXkuaXNBcnJheSBpc24ndCBhdmFpbGFibGUgZXZlcnl3aGVyZVxuICAgICAgICAgICAgICAgIGlmIChyYW5nZVN1Ym5ldHNbMF0gJiYgIShyYW5nZVN1Ym5ldHNbMF0gaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmFuZ2VTdWJuZXRzID0gW3JhbmdlU3VibmV0c107XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHJhbmdlU3VibmV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBzdWJuZXQgPSByYW5nZVN1Ym5ldHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChhZGRyZXNzLmtpbmQoKSA9PT0gc3VibmV0WzBdLmtpbmQoKSAmJiBhZGRyZXNzLm1hdGNoLmFwcGx5KGFkZHJlc3MsIHN1Ym5ldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByYW5nZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmYXVsdE5hbWU7XG4gICAgfTtcblxuICAgIC8vIEV4cG9ydCBmb3IgYm90aCB0aGUgQ29tbW9uSlMgYW5kIGJyb3dzZXItbGlrZSBlbnZpcm9ubWVudFxuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGlwYWRkcjtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJvb3QuaXBhZGRyID0gaXBhZGRyO1xuICAgIH1cblxufSh0aGlzKSk7XG4iLCAiaW1wb3J0IHBnIGZyb20gJ3BnJztcblxuY29uc3QgeyBQb29sIH0gPSBwZztcblxuaWYgKCFwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwpIHtcbiAgY29uc29sZS53YXJuKCdbZGJdIERBVEFCQVNFX1VSTCBub3Qgc2V0IFx1MjAxNCBkYXRhYmFzZSBmZWF0dXJlcyB3aWxsIGJlIHVuYXZhaWxhYmxlLicpO1xufVxuXG5leHBvcnQgY29uc3QgcG9vbCA9IG5ldyBQb29sKHtcbiAgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzBfMDAwLFxuICBjb25uZWN0aW9uVGltZW91dE1pbGxpczogNV8wMDAsXG4gIHNzbDogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMPy5pbmNsdWRlcygnbG9jYWxob3N0JykgPyBmYWxzZSA6IHsgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSB9LFxufSk7XG5cbnBvb2wub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICBjb25zb2xlLmVycm9yKCdbZGJdIGlkbGUgY2xpZW50IGVycm9yJywgZXJyLm1lc3NhZ2UpO1xufSk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxdWVyeTxUIGV4dGVuZHMgcGcuUXVlcnlSZXN1bHRSb3cgPSBwZy5RdWVyeVJlc3VsdFJvdz4oXG4gIHRleHQ6IHN0cmluZyxcbiAgdmFsdWVzPzogdW5rbm93bltdXG4pOiBQcm9taXNlPHBnLlF1ZXJ5UmVzdWx0PFQ+PiB7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBjbGllbnQucXVlcnk8VD4odGV4dCwgdmFsdWVzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjbGllbnQucmVsZWFzZSgpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgdGVzdCB9IGZyb20gJ25vZGU6dGVzdCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0L3N0cmljdCc7XG5pbXBvcnQgeyB2aWRlb0NyZWRpdENvc3QsIENSRURJVF9DT1NUUyB9IGZyb20gJy4uL3NyYy9saWIvY3JlZGl0cy5qcyc7XG5pbXBvcnQgeyBnZW1pbmlNb2RlbENoYWluIH0gZnJvbSAnLi4vc3JjL2xpYi92ZW8uanMnO1xuaW1wb3J0IHsgUFJPRFVDVFMgfSBmcm9tICcuLi9zcmMvcm91dGVzL3BheXBhbC5qcyc7XG5cbi8vIE9mZmljaWFsIEdlbWluaSBEZXZlbG9wZXIgQVBJIHJhdGVzIGNoZWNrZWQgMjAyNi0wOC0xMC5cbmNvbnN0IEZBU1RfMTA4MFBfVVNEX1BFUl9TRUMgPSAwLjEyO1xuY29uc3QgRkFTVF80S19VU0RfUEVSX1NFQyA9IDAuMzA7XG5jb25zdCBTVEFOREFSRF8xMDgwUF9VU0RfUEVSX1NFQyA9IDAuNDA7XG5jb25zdCBTVEFOREFSRF80S19VU0RfUEVSX1NFQyA9IDAuNjA7XG5jb25zdCBJTUFHRV80S19VU0QgPSAwLjE1MTtcbmNvbnN0IENIRUFQRVNUX1NVQlNDUklQVElPTl9DUkVESVRfVVNEID0gOTkgLyA0MDA7IC8vIFBybzogJDAuMjQ3NVxuY29uc3QgVFRTXzU2X1NFQ09ORFNfVVNEID0gKDU2ICogMjUgLyAxXzAwMF8wMDApICogMjA7XG5jb25zdCBURVhUX0FORF9JTlBVVF9BTExPV0FOQ0VfVVNEID0gMC4yMDtcblxuZnVuY3Rpb24gd2l0aFZpZGVvTW9kZWwobW9kZWw6IHN0cmluZyB8IHVuZGVmaW5lZCwgcnVuOiAoKSA9PiB2b2lkKSB7XG4gIGNvbnN0IHByZXZpb3VzID0gcHJvY2Vzcy5lbnYuR0VNSU5JX1ZJREVPX01PREVMO1xuICBpZiAobW9kZWwgPT09IHVuZGVmaW5lZCkgZGVsZXRlIHByb2Nlc3MuZW52LkdFTUlOSV9WSURFT19NT0RFTDtcbiAgZWxzZSBwcm9jZXNzLmVudi5HRU1JTklfVklERU9fTU9ERUwgPSBtb2RlbDtcbiAgdHJ5IHsgcnVuKCk7IH1cbiAgZmluYWxseSB7XG4gICAgaWYgKHByZXZpb3VzID09PSB1bmRlZmluZWQpIGRlbGV0ZSBwcm9jZXNzLmVudi5HRU1JTklfVklERU9fTU9ERUw7XG4gICAgZWxzZSBwcm9jZXNzLmVudi5HRU1JTklfVklERU9fTU9ERUwgPSBwcmV2aW91cztcbiAgfVxufVxuXG50ZXN0KCd0aGUgYXV0b21hdGljIEdlbWluaSBtb2RlbCBjaGFpbiBjYW5ub3Qgc2lsZW50bHkgZmFsbCBiYWNrIHRvIG1hcmdpbi1icmVha2luZyBTdGFuZGFyZCcsICgpID0+IHtcbiAgd2l0aFZpZGVvTW9kZWwodW5kZWZpbmVkLCAoKSA9PiBhc3NlcnQuZGVlcEVxdWFsKGdlbWluaU1vZGVsQ2hhaW4oKSwgWyd2ZW8tMy4xLWZhc3QtZ2VuZXJhdGUtcHJldmlldyddKSk7XG59KTtcblxudGVzdCgnRmFzdCAxMDgwcCBhbmQgNEsgY2hhcmdlcyBjb3ZlciBwcm92aWRlciBjb3N0IGJ5IGF0IGxlYXN0IDJ4IGF0IHRoZSBjaGVhcGVzdCBzdWJzY3JpcHRpb24gY3JlZGl0IHZhbHVlJywgKCkgPT4ge1xuICB3aXRoVmlkZW9Nb2RlbCh1bmRlZmluZWQsICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IFtxdWFsaXR5LCBwcm92aWRlclJhdGVdIG9mIFtbJzEwODBwJywgRkFTVF8xMDgwUF9VU0RfUEVSX1NFQ10sIFsnNGsnLCBGQVNUXzRLX1VTRF9QRVJfU0VDXV0gYXMgY29uc3QpIHtcbiAgICAgIGNvbnN0IGNyZWRpdHMgPSB2aWRlb0NyZWRpdENvc3QoJ3ZpZGVvJywgdHJ1ZSwgNTYsIHF1YWxpdHkpO1xuICAgICAgY29uc3QgcmV2ZW51ZSA9IGNyZWRpdHMgKiBDSEVBUEVTVF9TVUJTQ1JJUFRJT05fQ1JFRElUX1VTRDtcbiAgICAgIGNvbnN0IHByb3ZpZGVyQ29zdCA9IDU2ICogcHJvdmlkZXJSYXRlO1xuICAgICAgYXNzZXJ0Lm9rKHJldmVudWUgPj0gcHJvdmlkZXJDb3N0ICogMiwgYCR7cXVhbGl0eX06ICQke3JldmVudWUudG9GaXhlZCgyKX0gcmV2ZW51ZSBtdXN0IGNvdmVyIDJ4ICQke3Byb3ZpZGVyQ29zdC50b0ZpeGVkKDIpfSBwcm92aWRlciBjb3N0YCk7XG4gICAgfVxuICB9KTtcbn0pO1xuXG50ZXN0KCdhbiBleHBsaWNpdGx5IHBpbm5lZCBTdGFuZGFyZCBtb2RlbCBhdXRvbWF0aWNhbGx5IGNoYXJnZXMgY29uc2VydmF0aXZlIGNyZWRpdHMnLCAoKSA9PiB7XG4gIHdpdGhWaWRlb01vZGVsKCd2ZW8tMy4xLWdlbmVyYXRlLXByZXZpZXcnLCAoKSA9PiB7XG4gICAgY29uc3QgY3JlZGl0czEwODAgPSB2aWRlb0NyZWRpdENvc3QoJ3ZpZGVvJywgdHJ1ZSwgOCwgJzEwODBwJyk7XG4gICAgY29uc3QgY3JlZGl0czRrID0gdmlkZW9DcmVkaXRDb3N0KCd2aWRlbycsIHRydWUsIDgsICc0aycpO1xuICAgIGFzc2VydC5lcXVhbChjcmVkaXRzMTA4MCwgOCAqIENSRURJVF9DT1NUUy5WSURFT19QRVJfU0VDT05EX1NUQU5EQVJEXzEwODBQKTtcbiAgICBhc3NlcnQuZXF1YWwoY3JlZGl0czRrLCA4ICogQ1JFRElUX0NPU1RTLlZJREVPX1BFUl9TRUNPTkRfU1RBTkRBUkRfNEspO1xuICAgIGFzc2VydC5vayhjcmVkaXRzMTA4MCAqIENIRUFQRVNUX1NVQlNDUklQVElPTl9DUkVESVRfVVNEID49IDggKiBTVEFOREFSRF8xMDgwUF9VU0RfUEVSX1NFQyAqIDIpO1xuICAgIGFzc2VydC5vayhjcmVkaXRzNGsgKiBDSEVBUEVTVF9TVUJTQ1JJUFRJT05fQ1JFRElUX1VTRCA+PSA4ICogU1RBTkRBUkRfNEtfVVNEX1BFUl9TRUMgKiAyKTtcbiAgfSk7XG59KTtcblxudGVzdCgnZXZlcnkgc3Vic2NyaXB0aW9uIHJlbWFpbnMgYWJvdmUgMnggRmFzdCAxMDgwcCBjb3N0IHdoZW4gYWxsIGNyZWRpdHMgYXJlIHVzZWQnLCAoKSA9PiB7XG4gIGNvbnN0IHBsYW5zID0gW1BST0RVQ1RTLmNyZWF0b3IsIFBST0RVQ1RTLnBybywgUFJPRFVDVFMuYWdlbmN5XTtcbiAgZm9yIChjb25zdCBwbGFuIG9mIHBsYW5zKSB7XG4gICAgY29uc3QgcHJvdmlkZXJDb3N0ID0gcGxhbi5jcmVkaXRzICogRkFTVF8xMDgwUF9VU0RfUEVSX1NFQztcbiAgICBhc3NlcnQub2socGxhbi5hbW91bnRVc2QgPj0gcHJvdmlkZXJDb3N0ICogMiwgYCQke3BsYW4uYW1vdW50VXNkfSBwbGFuIHdpdGggJHtwbGFuLmNyZWRpdHN9IGNyZWRpdHMgbXVzdCBjb3ZlciAyeCAkJHtwcm92aWRlckNvc3QudG9GaXhlZCgyKX1gKTtcbiAgfVxufSk7XG5cbnRlc3QoJ29uZS10aW1lIDEwODBwIHZpZGVvIHBhY2tzIGluY2x1ZGUgbmFycmF0aW9uIGNyZWRpdHMgYW5kIGNsZWFyIHRoZSAyeCBjb3N0IGZsb29yJywgKCkgPT4ge1xuICBjb25zdCBwYWNrcyA9IFtcbiAgICB7IHByb2R1Y3Q6IFBST0RVQ1RTLnNpbmdsZTgsIHNlY29uZHM6IDggfSxcbiAgICB7IHByb2R1Y3Q6IFBST0RVQ1RTLnNpbmdsZTMwLCBzZWNvbmRzOiAyNCB9LFxuICAgIHsgcHJvZHVjdDogUFJPRFVDVFMuc2luZ2xlNjAsIHNlY29uZHM6IDU2IH0sXG4gIF07XG4gIHdpdGhWaWRlb01vZGVsKHVuZGVmaW5lZCwgKCkgPT4ge1xuICAgIGZvciAoY29uc3QgeyBwcm9kdWN0LCBzZWNvbmRzIH0gb2YgcGFja3MpIHtcbiAgICAgIGFzc2VydC5lcXVhbChwcm9kdWN0LmNyZWRpdHMsIHZpZGVvQ3JlZGl0Q29zdCgndmlkZW8nLCBmYWxzZSwgc2Vjb25kcywgJzEwODBwJykpO1xuICAgICAgY29uc3QgY29uc2VydmF0aXZlQ29zdCA9IHNlY29uZHMgKiBGQVNUXzEwODBQX1VTRF9QRVJfU0VDICsgVFRTXzU2X1NFQ09ORFNfVVNEICsgVEVYVF9BTkRfSU5QVVRfQUxMT1dBTkNFX1VTRDtcbiAgICAgIGFzc2VydC5vayhwcm9kdWN0LmFtb3VudFVzZCA+PSBjb25zZXJ2YXRpdmVDb3N0ICogMiwgYCQke3Byb2R1Y3QuYW1vdW50VXNkfSBwYWNrIG11c3QgY292ZXIgMnggJCR7Y29uc2VydmF0aXZlQ29zdC50b0ZpeGVkKDIpfWApO1xuICAgIH1cbiAgfSk7XG59KTtcblxudGVzdCgncGhvdG8gc2V0cyBhbmQgMTAwLWNyZWRpdCB0b3AtdXBzIGNsZWFyIHRoZSAyeCBwcm92aWRlci1jb3N0IGZsb29yJywgKCkgPT4ge1xuICBjb25zdCBwaG90b1JldmVudWUgPSBDUkVESVRfQ09TVFMuUEhPVE9fU0VUXzQgKiBDSEVBUEVTVF9TVUJTQ1JJUFRJT05fQ1JFRElUX1VTRDtcbiAgY29uc3QgcGhvdG9Db3N0ID0gSU1BR0VfNEtfVVNEICogNCArIFRFWFRfQU5EX0lOUFVUX0FMTE9XQU5DRV9VU0Q7XG4gIGFzc2VydC5vayhwaG90b1JldmVudWUgPj0gcGhvdG9Db3N0ICogMik7XG4gIGFzc2VydC5vayhQUk9EVUNUUy50b3B1cDEwMC5hbW91bnRVc2QgPj0gUFJPRFVDVFMudG9wdXAxMDAuY3JlZGl0cyAqIEZBU1RfMTA4MFBfVVNEX1BFUl9TRUMgKiAyKTtcbn0pO1xuIiwgImV4cG9ydCBjb25zdCBDUkVESVRfQ09TVFMgPSB7XG4gIFBIT1RPX1NJTkdMRTogMixcbiAgUEhPVE9fU0VUXzQ6IDgsXG4gIC8qKiBPbmUgY3JlZGl0IHBlciBnZW5lcmF0ZWQgc2Vjb25kIGF0IDEwODBwOyByZXRhaWwgY3JlZGl0IHZhbHVlIGlzIGtlcHQgYWJvdmUgJDAuMjAuICovXG4gIFZJREVPX1BFUl9TRUNPTkQ6IDEsXG4gIC8qKlxuICAgKiA0SyBtdWx0aXBsaWVyIGZvciB2aWRlbyBjcmVkaXRzLiBSZWFsIHByb3ZpZGVyIHByaWNpbmcgKFZlbyAzLjEgRmFzdCxcbiAgICogY29uZmlybWVkIGFnYWluc3QgR29vZ2xlJ3MgcHVibGlzaGVkIHJhdGVzKTogMTA4MHAgPSAkMC4xMi9zZWMsIDRLID1cbiAgICogJDAuMzAvc2VjIFx1MjAxNCBhIDIuNXggcmVhbCBjb3N0IGp1bXAgdGhhdCB3YXMgcHJldmlvdXNseSBOT1QgcmVmbGVjdGVkIGluXG4gICAqIGNyZWRpdCBwcmljaW5nIGF0IGFsbCAoNEsgY2hhcmdlZCB0aGUgZXhhY3Qgc2FtZSAxIGNyZWRpdC9zZWMgYXNcbiAgICogMTA4MHApLiBBdCB0aGUgYWNjb3VudCdzIGNoZWFwZXN0IHBlci1jcmVkaXQgc2VsbCBwcmljZSAofiQwLjI0NzUsXG4gICAqIEFnZW5jeSBwbGFuKSwgdGhhdCBtZWFudCBldmVyeSBzdWJzY3JpcHRpb24gcGxhbiB3ZW50IG5ldC1uZWdhdGl2ZSBmb3JcbiAgICogYW55IHN1YnNjcmliZXIgd2hvIGdlbmVyYXRlZCA0SyB2aWRlbywgYW5kIG9uZS10aW1lIHZpZGVvIHB1cmNoYXNlc1xuICAgKiBzaHJhbmsgdG8gbmVhci16ZXJvIG1hcmdpbi4gMyBjcmVkaXRzL3NlYyBmb3IgNEsga2VlcHMgYSBoZWFsdGh5IH4yLjV4K1xuICAgKiBtYXJnaW4gb3ZlciBGYXN0LW1vZGVsIGNvc3QuXG4gICAqL1xuICBWSURFT19QRVJfU0VDT05EXzRLOiAzLFxuICAvKiogQ29uc2VydmF0aXZlIHJhdGVzIHVzZWQgd2hlbiB0aGUgb3BlcmF0b3IgZXhwbGljaXRseSBwaW5zIFZlbyBTdGFuZGFyZC4gKi9cbiAgVklERU9fUEVSX1NFQ09ORF9TVEFOREFSRF8xMDgwUDogNCxcbiAgVklERU9fUEVSX1NFQ09ORF9TVEFOREFSRF80SzogNSxcbiAgLyoqIEZsYXQgc3VyY2hhcmdlIGZvciBhIGdlbmVyYXRlZCBuYXJyYXRpb24gc2NyaXB0ICsgVFRTIHN5bnRoZXNpcyBwYXNzLiAqL1xuICBWT0lDRU9WRVI6IDYsXG59O1xuXG5leHBvcnQgY29uc3QgTUlOX1ZJREVPX1NFQ09ORFMgPSA4O1xuZXhwb3J0IGNvbnN0IE1BWF9WSURFT19TRUNPTkRTID0gMjQwO1xuZXhwb3J0IGNvbnN0IFZJREVPX1NDRU5FX1NFQ09ORFMgPSA4O1xuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplZEdlbmVyYXRlZFNlY29uZHMoZHVyYXRpb25TZWNvbmRzID0gTUlOX1ZJREVPX1NFQ09ORFMpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoTUlOX1ZJREVPX1NFQ09ORFMsIE1hdGgubWluKE1BWF9WSURFT19TRUNPTkRTLCBNYXRoLmNlaWwoZHVyYXRpb25TZWNvbmRzIC8gVklERU9fU0NFTkVfU0VDT05EUykgKiBWSURFT19TQ0VORV9TRUNPTkRTKSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlkZW9DcmVkaXRRdW90ZSB7XG4gIGdlbmVyYXRlZFNlY29uZHM6IG51bWJlcjtcbiAgcGVyU2Vjb25kQ3JlZGl0czogbnVtYmVyO1xuICB2aWRlb0NyZWRpdHM6IG51bWJlcjtcbiAgcGhvdG9DcmVkaXRzOiBudW1iZXI7XG4gIG5hcnJhdGlvbkNyZWRpdHM6IG51bWJlcjtcbiAgdG90YWxDcmVkaXRzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2aWRlb0NyZWRpdFF1b3RlKG1vZGU6IHN0cmluZywgc2tpcFZvaWNlb3ZlcjogYm9vbGVhbiwgZHVyYXRpb25TZWNvbmRzID0gOCwgb3V0cHV0UXVhbGl0eTogJzEwODBwJyB8ICc0aycgPSAnMTA4MHAnKTogVmlkZW9DcmVkaXRRdW90ZSB7XG4gIGlmIChtb2RlID09PSAncGhvdG9zJyB8fCBtb2RlID09PSAnaWNvbicpIHtcbiAgICByZXR1cm4geyBnZW5lcmF0ZWRTZWNvbmRzOiAwLCBwZXJTZWNvbmRDcmVkaXRzOiAwLCB2aWRlb0NyZWRpdHM6IDAsIHBob3RvQ3JlZGl0czogQ1JFRElUX0NPU1RTLlBIT1RPX1NFVF80LCBuYXJyYXRpb25DcmVkaXRzOiAwLCB0b3RhbENyZWRpdHM6IENSRURJVF9DT1NUUy5QSE9UT19TRVRfNCB9O1xuICB9XG4gIGNvbnN0IGdlbmVyYXRlZFNlY29uZHMgPSBub3JtYWxpemVkR2VuZXJhdGVkU2Vjb25kcyhkdXJhdGlvblNlY29uZHMpO1xuICBjb25zdCBjb25maWd1cmVkTW9kZWwgPSAocHJvY2Vzcy5lbnYuR0VNSU5JX1ZJREVPX01PREVMID8/ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBzdGFuZGFyZE1vZGVsID0gY29uZmlndXJlZE1vZGVsLmluY2x1ZGVzKCd2ZW8nKSAmJiAhY29uZmlndXJlZE1vZGVsLmluY2x1ZGVzKCdmYXN0JykgJiYgIWNvbmZpZ3VyZWRNb2RlbC5pbmNsdWRlcygnbGl0ZScpO1xuICBjb25zdCBwZXJTZWNvbmRDcmVkaXRzID0gc3RhbmRhcmRNb2RlbFxuICAgID8gKG91dHB1dFF1YWxpdHkgPT09ICc0aycgPyBDUkVESVRfQ09TVFMuVklERU9fUEVSX1NFQ09ORF9TVEFOREFSRF80SyA6IENSRURJVF9DT1NUUy5WSURFT19QRVJfU0VDT05EX1NUQU5EQVJEXzEwODBQKVxuICAgIDogKG91dHB1dFF1YWxpdHkgPT09ICc0aycgPyBDUkVESVRfQ09TVFMuVklERU9fUEVSX1NFQ09ORF80SyA6IENSRURJVF9DT1NUUy5WSURFT19QRVJfU0VDT05EKTtcbiAgY29uc3QgdmlkZW9DcmVkaXRzID0gZ2VuZXJhdGVkU2Vjb25kcyAqIHBlclNlY29uZENyZWRpdHM7XG4gIGNvbnN0IHBob3RvQ3JlZGl0cyA9IG1vZGUgPT09ICdib3RoJyA/IENSRURJVF9DT1NUUy5QSE9UT19TRVRfNCA6IDA7XG4gIGNvbnN0IG5hcnJhdGlvbkNyZWRpdHMgPSBza2lwVm9pY2VvdmVyID8gMCA6IENSRURJVF9DT1NUUy5WT0lDRU9WRVI7XG4gIHJldHVybiB7IGdlbmVyYXRlZFNlY29uZHMsIHBlclNlY29uZENyZWRpdHMsIHZpZGVvQ3JlZGl0cywgcGhvdG9DcmVkaXRzLCBuYXJyYXRpb25DcmVkaXRzLCB0b3RhbENyZWRpdHM6IHZpZGVvQ3JlZGl0cyArIHBob3RvQ3JlZGl0cyArIG5hcnJhdGlvbkNyZWRpdHMgfTtcbn1cblxuLyoqXG4gKiBDb3N0IG9mIGEgcmVuZGVyOlxuICogLSBwaG90b3M6IGZsYXQgcGhvdG8tc2V0IHByaWNlXG4gKiAtIHZpZGVvL3R1dG9yaWFsL2J1eS90b3VyOiBwZXIgOHMgc2NlbmUgY2xpcCAoNjBzIFx1MjI0OCA3IGNsaXBzKVxuICogLSBkZW1vOiBzYW1lIHBlci1zZWNvbmQgQUkgdmlkZW8gcHJpY2U7IGRlbW8gbm8gbG9uZ2VyIGdlbmVyYXRlcyBzdGlsbFxuICogICBpbWFnZXMgZmlyc3Qgb3IgYW5pbWF0ZXMgdGhlbSB3aXRoIGNvZGUuXG4gKiAtIGJvdGg6IHZpZGVvIHByaWNlICsgcGhvdG8tc2V0IHByaWNlXG4gKiAtICsgVk9JQ0VPVkVSIHN1cmNoYXJnZSB3aGVuZXZlciBuYXJyYXRpb24gaXMgcmVxdWVzdGVkIChub3Qgc2tpcFZvaWNlb3ZlcilcbiAqICAgZm9yIGFueSBub24tcGhvdG9zIG1vZGUsIHNpbmNlIHRoYXQncyBhIHJlYWwgc2NyaXB0LWdlbmVyYXRpb24gKyBUVFNcbiAqICAgc3ludGhlc2lzIGNhbGwgdGhhdCBzaWxlbnQgcmVuZGVycyBkb24ndCBtYWtlLlxuICogLSA0SyBvdXRwdXQgY2hhcmdlcyBWSURFT19QRVJfU0VDT05EXzRLIGluc3RlYWQgb2YgVklERU9fUEVSX1NFQ09ORCBcdTIwMTQgc2VlXG4gKiAgIHRoYXQgY29uc3RhbnQncyBjb21tZW50IGZvciB0aGUgcmVhbC1jb3N0IG1hdGggYmVoaW5kIHRoZSBtdWx0aXBsaWVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmlkZW9DcmVkaXRDb3N0KG1vZGU6IHN0cmluZywgc2tpcFZvaWNlb3ZlcjogYm9vbGVhbiwgZHVyYXRpb25TZWNvbmRzID0gOCwgb3V0cHV0UXVhbGl0eTogJzEwODBwJyB8ICc0aycgPSAnMTA4MHAnKTogbnVtYmVyIHtcbiAgcmV0dXJuIHZpZGVvQ3JlZGl0UXVvdGUobW9kZSwgc2tpcFZvaWNlb3ZlciwgZHVyYXRpb25TZWNvbmRzLCBvdXRwdXRRdWFsaXR5KS50b3RhbENyZWRpdHM7XG59XG4iLCAiaW1wb3J0IHsgZXhlY0ZpbGUgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgR29vZ2xlR2VuQUkgfSBmcm9tICdAZ29vZ2xlL2dlbmFpJztcbmltcG9ydCB7IEFTU0VUU19ESVIgfSBmcm9tICcuL2NhcHR1cmUuanMnO1xuaW1wb3J0IHR5cGUgeyBTdG9yeWJvYXJkLCBTdG9yeWJvYXJkU2NlbmUgfSBmcm9tICcuL2dlbWluaS5qcyc7XG5pbXBvcnQgeyBnZXRQcm92aWRlclNldHRpbmdzLCBwcm92aWRlckF2YWlsYWJpbGl0eSwgcmVzb2x2ZVByb3ZpZGVyIH0gZnJvbSAnLi9wcm92aWRlci1jb25maWcuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVHcHVWaWRlbyB9IGZyb20gJy4vc2VsZi1ob3N0ZWQuanMnO1xuaW1wb3J0IHsgYnVpbGRBaVZpZGVvU2NlbmVQcm9tcHQgfSBmcm9tICcuL3ZpZGVvLXByb21wdHMuanMnO1xuaW1wb3J0IHsgR0VNSU5JX0NPU1RfQ0FUQUxPRywgcmVjb3JkR2VuZXJhdGlvbkNvc3QgfSBmcm9tICcuL2Nvc3RzLmpzJztcbmltcG9ydCB7IHF1ZXJ5IH0gZnJvbSAnLi9wb29sLmpzJztcblxuY29uc3QgZXhlY0ZpbGVBc3luYyA9IHByb21pc2lmeShleGVjRmlsZSk7XG5jb25zdCBWSURFT19DT05DVVJSRU5DWSA9IE1hdGgubWF4KDEsIE1hdGgubWluKDMsIE51bWJlcihwcm9jZXNzLmVudi5BSV9WSURFT19DT05DVVJSRU5DWSA/PyAyKSkpO1xuY29uc3QgUE9MTF9NUyA9IE1hdGgubWF4KDJfMDAwLCBOdW1iZXIocHJvY2Vzcy5lbnYuR0VNSU5JX1ZJREVPX1BPTExfTVMgPz8gMTBfMDAwKSk7XG5jb25zdCBQT0xMX0xPR19NUyA9IE1hdGgubWF4KFBPTExfTVMsIE51bWJlcihwcm9jZXNzLmVudi5HRU1JTklfVklERU9fUE9MTF9MT0dfTVMgPz8gMzBfMDAwKSk7XG5jb25zdCBHRU5FUkFUSU9OX1RJTUVPVVRfTVMgPSBNYXRoLm1heCg2MF8wMDAsIE51bWJlcihwcm9jZXNzLmVudi5HRU1JTklfVklERU9fVElNRU9VVF9NUyA/PyAxMiAqIDYwXzAwMCkpO1xuY29uc3QgREVGQVVMVF9UT1RBTF9HRU5FUkFUSU9OX1RJTUVPVVRfTVMgPSAyNCAqIDYwXzAwMDtcbmNvbnN0IFRPVEFMX0dFTkVSQVRJT05fVElNRU9VVF9FTlYgPSBwcm9jZXNzLmVudi5BSV9WSURFT19UT1RBTF9USU1FT1VUX01TO1xuY29uc3QgRklOSVNISU5HX0JVRkZFUl9NUyA9IDYgKiA2MF8wMDA7IC8vIHN0aXRjaGluZywgYXVkaW8gbWl4LCBuYXJyYXRpb24sIGZpbmFsIG11eFxuXG4vKipcbiAqIEEgZml4ZWQgdG90YWwtam9iIHRpbWVvdXQgZG9lc24ndCBzY2FsZSB3aXRoIGhvdyBtYW55IHNjZW5lcyBhIHByb2R1Y3Rpb25cbiAqIGFjdHVhbGx5IGhhcy4gQSAzLXNjZW5lIHNob3J0IGFuZCBhbiA4LXNjZW5lIGNpbmVtYXRpYyBmaWxtIGF0IHRoZSBzYW1lXG4gKiBwZXItc2NlbmUgcG9sbCBidWRnZXQgbGVnaXRpbWF0ZWx5IG5lZWQgdmVyeSBkaWZmZXJlbnQgdG90YWwgYnVkZ2V0cyBcdTIwMTQgYVxuICogZml4ZWQgMjQtbWludXRlIGNhcCBjYW4ga2lsbCBhIGxvbmdlciBqb2IgdGhhdCBpcyBnZW5lcmF0aW5nIGNvcnJlY3RseSBidXRcbiAqIHNpbXBseSBoYXMgbW9yZSBiYXRjaGVzIHRvIGdldCB0aHJvdWdoLiBJZiB0aGUgb3BlcmF0b3IgZXhwbGljaXRseSBzZXRzXG4gKiBBSV9WSURFT19UT1RBTF9USU1FT1VUX01TLCB0aGF0IHZhbHVlIGFsd2F5cyB3aW5zOyBvdGhlcndpc2UgdGhlIGRlYWRsaW5lXG4gKiBzY2FsZXMgd2l0aCB0aGUgcmVhbCBiYXRjaCBjb3VudCBzbyBpdCBhbHdheXMgaGFzIGhlYWRyb29tIG92ZXIgdGhlXG4gKiBwZXItc2NlbmUgdGltZW91dCB0aGF0J3MgYWxyZWFkeSBiZWluZyBlbmZvcmNlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvdGFsR2VuZXJhdGlvblRpbWVvdXRNcyhzY2VuZUNvdW50OiBudW1iZXIpOiBudW1iZXIge1xuICBpZiAoVE9UQUxfR0VORVJBVElPTl9USU1FT1VUX0VOVikge1xuICAgIHJldHVybiBNYXRoLm1heCg1ICogNjBfMDAwLCBOdW1iZXIoVE9UQUxfR0VORVJBVElPTl9USU1FT1VUX0VOVikpO1xuICB9XG4gIGNvbnN0IGJhdGNoZXMgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwoTWF0aC5tYXgoMSwgc2NlbmVDb3VudCkgLyBWSURFT19DT05DVVJSRU5DWSkpO1xuICBjb25zdCBzY2FsZWQgPSBiYXRjaGVzICogR0VORVJBVElPTl9USU1FT1VUX01TICsgRklOSVNISU5HX0JVRkZFUl9NUztcbiAgcmV0dXJuIE1hdGgubWF4KERFRkFVTFRfVE9UQUxfR0VORVJBVElPTl9USU1FT1VUX01TLCBzY2FsZWQpO1xufVxuXG5sZXQgZ2VtaW5pQ2xpZW50OiBHb29nbGVHZW5BSSB8IG51bGwgPSBudWxsO1xuZnVuY3Rpb24gZ2V0R2VtaW5pQ2xpZW50KCkge1xuICBpZiAoIWdlbWluaUNsaWVudCkge1xuICAgIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LkdFTUlOSV9BUElfS0VZO1xuICAgIGlmICghYXBpS2V5KSB0aHJvdyBuZXcgRXJyb3IoJ0dFTUlOSV9BUElfS0VZIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIG5vdCBzZXQuJyk7XG4gICAgZ2VtaW5pQ2xpZW50ID0gbmV3IEdvb2dsZUdlbkFJKHsgYXBpS2V5IH0pO1xuICB9XG4gIHJldHVybiBnZW1pbmlDbGllbnQ7XG59XG5cbmV4cG9ydCB0eXBlIFZpZGVvQXNwZWN0UmF0aW8gPSAnMTY6OScgfCAnOToxNicgfCAnMToxJztcblxuZXhwb3J0IGludGVyZmFjZSBHZW5lcmF0ZWRWaWRlbyB7XG4gIHVybDogc3RyaW5nO1xuICBhc3BlY3RSYXRpbzogVmlkZW9Bc3BlY3RSYXRpbztcbiAgY2xpcENvdW50OiBudW1iZXI7XG4gIG91dHB1dFF1YWxpdHk6ICcxMDgwcCcgfCAnNGsnO1xuICBmcmFtZVJhdGU6IDMwIHwgNjA7XG4gIG5hcnJhdGlvbkVycm9yPzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBBdWRpb01vZGUgPSAndm9pY2VfbXVzaWMnIHwgJ211c2ljX29ubHknIHwgJ3NpbGVudCc7XG5cbmZ1bmN0aW9uIG91dHB1dEZyYW1lKGFzcGVjdFJhdGlvOiBWaWRlb0FzcGVjdFJhdGlvLCBxdWFsaXR5OiAnMTA4MHAnIHwgJzRrJykge1xuICBjb25zdCBzY2FsZSA9IHF1YWxpdHkgPT09ICc0aycgPyAyIDogMTtcbiAgaWYgKGFzcGVjdFJhdGlvID09PSAnOToxNicpIHJldHVybiB7IHdpZHRoOiAxMDgwICogc2NhbGUsIGhlaWdodDogMTkyMCAqIHNjYWxlIH07XG4gIGlmIChhc3BlY3RSYXRpbyA9PT0gJzE6MScpIHJldHVybiB7IHdpZHRoOiAxMDgwICogc2NhbGUsIGhlaWdodDogMTA4MCAqIHNjYWxlIH07XG4gIHJldHVybiB7IHdpZHRoOiAxOTIwICogc2NhbGUsIGhlaWdodDogMTA4MCAqIHNjYWxlIH07XG59XG5cbmZ1bmN0aW9uIHByb3ZpZGVyQXNwZWN0UmF0aW8oYXNwZWN0UmF0aW86IFZpZGVvQXNwZWN0UmF0aW8pOiAnMTY6OScgfCAnOToxNicge1xuICAvLyBWZW8gY3VycmVudGx5IHN1cHBvcnRzIDE2OjkgYW5kIDk6MTYuIFNxdWFyZSBkZWxpdmVyeSBpcyBnZW5lcmF0ZWQgYXMgYVxuICAvLyBjZW50ZXItc2FmZSAxNjo5IEFJIGNsaXAsIHRoZW4gdGVjaG5pY2FsbHkgY3JvcHBlZCB0byAxOjEgaW4gbWFzdGVyaW5nLlxuICByZXR1cm4gYXNwZWN0UmF0aW8gPT09ICc5OjE2JyA/ICc5OjE2JyA6ICcxNjo5Jztcbn1cblxuZnVuY3Rpb24gaW1hZ2VGcm9tQnVmZmVyKGJ1ZmZlcjogQnVmZmVyKSB7XG4gIHJldHVybiB7IGltYWdlQnl0ZXM6IGJ1ZmZlci50b1N0cmluZygnYmFzZTY0JyksIG1pbWVUeXBlOiAnaW1hZ2UvanBlZycgfTtcbn1cblxuZnVuY3Rpb24gc2NlbmVSZWZlcmVuY2VJbmRpY2VzKHNjZW5lOiBTdG9yeWJvYXJkU2NlbmUsIHNjZW5lSW5kZXg6IG51bWJlciwgY291bnQ6IG51bWJlcikge1xuICBjb25zdCByZXF1ZXN0ZWQgPSAoc2NlbmUuc291cmNlSW5kaWNlcyA/PyBbXSlcbiAgICAuZmlsdGVyKChpbmRleCkgPT4gTnVtYmVyLmlzSW50ZWdlcihpbmRleCkgJiYgaW5kZXggPj0gMCAmJiBpbmRleCA8IGNvdW50KTtcbiAgY29uc3QgdW5pcXVlID0gWy4uLm5ldyBTZXQocmVxdWVzdGVkKV07XG4gIGlmICh1bmlxdWUubGVuZ3RoKSByZXR1cm4gdW5pcXVlLnNsaWNlKDAsIHNjZW5lLnNjZW5lVHlwZSA9PT0gJ2ludGVyYWN0aW9uJyA/IDIgOiAxKTtcbiAgcmV0dXJuIGNvdW50ID8gW3NjZW5lSW5kZXggJSBjb3VudF0gOiBbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaGFzQXVkaW8oZmlsZTogc3RyaW5nKSB7XG4gIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZnByb2JlJywgW1xuICAgICctdicsICdlcnJvcicsICctc2VsZWN0X3N0cmVhbXMnLCAnYTowJywgJy1zaG93X2VudHJpZXMnLCAnc3RyZWFtPWNvZGVjX3R5cGUnLCAnLW9mJywgJ2Nzdj1wPTAnLCBmaWxlLFxuICBdKS5jYXRjaCgoKSA9PiAoeyBzdGRvdXQ6ICcnIH0pKTtcbiAgcmV0dXJuIEJvb2xlYW4oc3Rkb3V0LnRyaW0oKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGR1cmF0aW9uKGZpbGU6IHN0cmluZykge1xuICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZwcm9iZScsIFtcbiAgICAnLXYnLCAnZXJyb3InLCAnLXNob3dfZW50cmllcycsICdmb3JtYXQ9ZHVyYXRpb24nLCAnLW9mJywgJ2RlZmF1bHQ9bnc9MTpuaz0xJywgZmlsZSxcbiAgXSk7XG4gIGNvbnN0IHZhbHVlID0gTnVtYmVyKHN0ZG91dC50cmltKCkpO1xuICBpZiAoIU51bWJlci5pc0Zpbml0ZSh2YWx1ZSkgfHwgdmFsdWUgPD0gMCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGdlbmVyYXRlZCB2aWRlbzogJHtwYXRoLmJhc2VuYW1lKGZpbGUpfS5gKTtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjb25jdXJyZW50TWFwPFQsIFI+KHZhbHVlczogVFtdLCB0YXNrOiAodmFsdWU6IFQsIGluZGV4OiBudW1iZXIpID0+IFByb21pc2U8Uj4pIHtcbiAgY29uc3QgcmVzdWx0czogQXJyYXk8UHJvbWlzZVNldHRsZWRSZXN1bHQ8Uj4+ID0gbmV3IEFycmF5KHZhbHVlcy5sZW5ndGgpO1xuICBsZXQgbmV4dCA9IDA7XG4gIGF3YWl0IFByb21pc2UuYWxsKEFycmF5LmZyb20oeyBsZW5ndGg6IE1hdGgubWluKFZJREVPX0NPTkNVUlJFTkNZLCB2YWx1ZXMubGVuZ3RoKSB9LCBhc3luYyAoKSA9PiB7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gbmV4dCsrO1xuICAgICAgaWYgKGluZGV4ID49IHZhbHVlcy5sZW5ndGgpIHJldHVybjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc3VsdHNbaW5kZXhdID0geyBzdGF0dXM6ICdmdWxmaWxsZWQnLCB2YWx1ZTogYXdhaXQgdGFzayh2YWx1ZXNbaW5kZXhdLCBpbmRleCkgfTtcbiAgICAgIH0gY2F0Y2ggKHJlYXNvbikge1xuICAgICAgICByZXN1bHRzW2luZGV4XSA9IHsgc3RhdHVzOiAncmVqZWN0ZWQnLCByZWFzb24gfTtcbiAgICAgIH1cbiAgICB9XG4gIH0pKTtcbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbi8vIEZpZWxkcyBWZW8gcmVqZWN0cyBvbiB0aGUgR2VtaW5pIERldmVsb3BlciBBUEkgKEVudGVycHJpc2UgQWdlbnRcbi8vIFBsYXRmb3JtLW9ubHkpLiBOZXZlciBhZGQgdGhlc2UgYmFjayB0byBidWlsZEdlbWluaVZpZGVvQ29uZmlnIFx1MjAxNCBzZWUgdGhlXG4vLyBnZW5lcmF0ZUF1ZGlvIGNvbW1lbnQgYmVsb3cgYW5kIHRoZSBgc2VlZGAgY29tbWVudCBuZWFyIHRoZSBBUEkgY2FsbC5cbmNvbnN0IEdFTUlOSV9ERVZFTE9QRVJfQVBJX1VOU1VQUE9SVEVEX0ZJRUxEUyA9IFsnZ2VuZXJhdGVBdWRpbycsICdzZWVkJ10gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEdlbWluaVZpZGVvQ29uZmlnKFxuICBhcGlBc3BlY3Q6ICcxNjo5JyB8ICc5OjE2JyxcbiAgcXVhbGl0eTogJzEwODBwJyB8ICc0aycsXG4gIGlzU3RhdGVUcmFuc2l0aW9uOiBib29sZWFuLFxuICBsYXN0RnJhbWU/OiB7IGltYWdlQnl0ZXM6IHN0cmluZzsgbWltZVR5cGU6IHN0cmluZyB9LFxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBjb25maWc6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgIG51bWJlck9mVmlkZW9zOiAxLFxuICAgIGFzcGVjdFJhdGlvOiBhcGlBc3BlY3QsXG4gICAgZHVyYXRpb25TZWNvbmRzOiA4LFxuICAgIHJlc29sdXRpb246IHF1YWxpdHkgPT09ICc0aycgPyAnNGsnIDogJzEwODBwJyxcbiAgICBwZXJzb25HZW5lcmF0aW9uOiAnYWxsb3dfYWR1bHQnLFxuICAgIG5lZ2F0aXZlUHJvbXB0OiAnZ2FyYmxlZCB0ZXh0LCBtaXNzcGVsbGVkIHRleHQsIGNoYW5nZWQgQXJhYmljIGxldHRlcnMsIGNoYW5nZWQgRW5nbGlzaCB3b3JkcywgZmFrZSBwcmljZXMsIGZha2UgYnV0dG9ucywgZmFrZSBVSSwgZHVwbGljYXRlZCBjb250cm9scywgd2FycGVkIGxvZ28sIGRpc3RvcnRlZCBwcm9kdWN0LCB1bnJlYWRhYmxlIGludGVyZmFjZSwgcmFuZG9tIHN1YnRpdGxlcywgcmFuZG9tIGNhcHRpb25zJyxcbiAgfTtcbiAgLy8gSU1QT1JUQU5UOiBkbyBOT1Qgc2VuZCBgZ2VuZXJhdGVBdWRpb2AgdG8gR2VtaW5pIERldmVsb3BlciBBUEkgVmVvIFx1MjAxNCBsaWtlXG4gIC8vIGBzZWVkYCwgdGhpcyBmaWVsZCBpcyBFbnRlcnByaXNlIEFnZW50IFBsYXRmb3JtLW9ubHkgYW5kIHRoZSByZXF1ZXN0IGlzXG4gIC8vIHJlamVjdGVkIG91dHJpZ2h0IHdpdGggXCJnZW5lcmF0ZUF1ZGlvIHBhcmFtZXRlciBpcyBvbmx5IHN1cHBvcnRlZCBpblxuICAvLyBHZW1pbmkgRW50ZXJwcmlzZSBBZ2VudCBQbGF0Zm9ybSBtb2RlLCBub3QgaW4gR2VtaW5pIERldmVsb3BlciBBUEkgbW9kZVwiXG4gIC8vIChjb25maXJtZWQgYWdhaW5zdCBsaXZlIHByb2R1Y3Rpb24gbG9ncyBhbmQgR29vZ2xlJ3Mgb3duIGRldmVsb3BlclxuICAvLyBmb3J1bSkuIHZlby0zLjEgb24gdGhlIERldmVsb3BlciBBUEkgZ2VuZXJhdGVzIG5hdGl2ZSBhdWRpbyBvbiBpdHMgb3duO1xuICAvLyB3aGV0aGVyIHRoZSBmaW5hbCBjbGlwIGFjdHVhbGx5IGhhcyBhbiBhdWRpbyB0cmFjayBpcyB2ZXJpZmllZCBhZnRlclxuICAvLyBkb3dubG9hZCB3aXRoIGZmcHJvYmUgaW4gbm9ybWFsaXplQ2xpcCgpL2hhc0F1ZGlvKCksIG5vdCBieSB0aGlzIGZsYWcgXHUyMDE0XG4gIC8vIHNvIG9taXR0aW5nIGl0IGhlcmUgZG9lcyBub3QgY2hhbmdlIHNpbGVudC1tb2RlIGJlaGF2aW9yIGRvd25zdHJlYW0uXG4gIGlmIChpc1N0YXRlVHJhbnNpdGlvbiAmJiBsYXN0RnJhbWUpIHtcbiAgICBjb25maWcubGFzdEZyYW1lID0gbGFzdEZyYW1lO1xuICB9XG4gIGZvciAoY29uc3QgZmllbGQgb2YgR0VNSU5JX0RFVkVMT1BFUl9BUElfVU5TVVBQT1JURURfRklFTERTKSB7XG4gICAgaWYgKGZpZWxkIGluIGNvbmZpZykgdGhyb3cgbmV3IEVycm9yKGBidWlsZEdlbWluaVZpZGVvQ29uZmlnIG11c3QgbmV2ZXIgaW5jbHVkZSAnJHtmaWVsZH0nIFx1MjAxNCBpdCBpcyByZWplY3RlZCBieSB0aGUgR2VtaW5pIERldmVsb3BlciBBUEkuYCk7XG4gIH1cbiAgcmV0dXJuIGNvbmZpZztcbn1cblxuLy8gRXJyb3JzIHdvcnRoIHJldHJ5aW5nIG9uIHRoZSBTQU1FIHByb3ZpZGVyIGJlZm9yZSBnaXZpbmcgdXAgdG8gdGhlIChtdWNoXG4vLyBzbG93ZXIsIGxvd2VyLXF1YWxpdHkpIGZhbGxiYWNrIHByb3ZpZGVyLiBSRVNPVVJDRV9FWEhBVVNURUQgaGVyZSBpc1xuLy8gdXN1YWxseSBHZW1pbmkncyBzcGVuZC1iYXNlZCByYXRlIGxpbWl0IFx1MjAxNCBhIHJvbGxpbmcgMTAtbWludXRlIHNwZW5kIGNhcFxuLy8gdGllZCB0byBhY2NvdW50IHVzYWdlIHRpZXIgKCQxMC8xMG1pbiBvbiBUaWVyIDEpLCBjb21wbGV0ZWx5IHNlcGFyYXRlXG4vLyBmcm9tIHByZXBhaWQgYmFsYW5jZS4gSXQgcmVsaWFibHkgY2xlYXJzIHdpdGhpbiBhIGZldyBtaW51dGVzIGFzIHRoZVxuLy8gcm9sbGluZyB3aW5kb3cgYWR2YW5jZXMsIHNvIGEgc2hvcnQgYmFja29mZi1hbmQtcmV0cnkgcmVjb3ZlcnMgdGhlIGpvYlxuLy8gb24gR2VtaW5pIGluc3RlYWQgb2YgdW5uZWNlc3NhcmlseSBmYWxsaW5nIGJhY2suIDQyOS81MDMvVU5BVkFJTEFCTEUgYXJlXG4vLyB0aGUgc3RhbmRhcmQgdHJhbnNpZW50LWZhaWx1cmUgc2lnbmFsczsgYW55dGhpbmcgZWxzZSAoYmFkIHJlcXVlc3QsXG4vLyBwZXJtaXNzaW9uIGRlbmllZCwgaW52YWxpZCBhcmd1bWVudCkgaXMgcGVybWFuZW50IGFuZCBtdXN0IG5vdCBiZSByZXRyaWVkLlxuZXhwb3J0IGZ1bmN0aW9uIGlzUmV0cnlhYmxlR2VtaW5pRXJyb3IobWVzc2FnZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiAvXCJjb2RlXCJcXHMqOlxccyo0Mjl8UkVTT1VSQ0VfRVhIQVVTVEVEfFwiY29kZVwiXFxzKjpcXHMqNTAzfFVOQVZBSUxBQkxFfEVDT05OUkVTRVR8RVRJTUVET1VUL2kudGVzdChtZXNzYWdlKTtcbn1cblxuY29uc3QgR0VNSU5JX1JFVFJZX0RFTEFZU19NUyA9IFsyMF8wMDAsIDYwXzAwMCwgMTIwXzAwMF07XG5cbi8vIElmIHRoZSBvcGVyYXRvciBwaW5zIGEgc3BlY2lmaWMgbW9kZWwgdmlhIEdFTUlOSV9WSURFT19NT0RFTCwgaG9ub3IgdGhhdFxuLy8gc2luZ2xlIGV4cGxpY2l0IGNob2ljZSBleGFjdGx5IChubyBzdXJwcmlzZSBzdWJzdGl0dXRpb24pLiBPdGhlcndpc2UsIGJ5XG4vLyBkZWZhdWx0LCB1c2UgRmFzdCAodGhlIG1hcmdpbi1zYWZlIGNob2ljZSBmb3IgdGhlIHB1YmxpYyBjYXRhbG9nKS4gU3RhbmRhcmRcbi8vIGNvc3RzICQwLjQwL3NlYyBhdCAxMDgwcCBhbmQgJDAuNjAvc2VjIGF0IDRLLCBzbyBzaWxlbnRseSBmYWxsaW5nIGJhY2sgdG8gaXRcbi8vIGFmdGVyIHJlc2VydmluZyBGYXN0LXByaWNlZCBjcmVkaXRzIHdvdWxkIGJyZWFrIHRoZSAyeCBwcm92aWRlci1jb3N0IGZsb29yLlxuLy8gQW4gZXhwbGljaXRseSBwaW5uZWQgU3RhbmRhcmQgbW9kZWwgaXMgc3RpbGwgc3VwcG9ydGVkOyB2aWRlb0NyZWRpdENvc3QoKVxuLy8gYXBwbGllcyBpdHMgY29uc2VydmF0aXZlIDQvNS1jcmVkaXQgcGVyLXNlY29uZCByYXRlcyBiZWZvcmUgZ2VuZXJhdGlvbi5cbmV4cG9ydCBmdW5jdGlvbiBnZW1pbmlNb2RlbENoYWluKCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgcGlubmVkID0gcHJvY2Vzcy5lbnYuR0VNSU5JX1ZJREVPX01PREVMO1xuICBpZiAocGlubmVkKSByZXR1cm4gW3Bpbm5lZF07XG4gIHJldHVybiBbJ3Zlby0zLjEtZmFzdC1nZW5lcmF0ZS1wcmV2aWV3J107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlR2VtaW5pU2NlbmUoXG4gIGpvYklkOiBzdHJpbmcsXG4gIHNjZW5lSW5kZXg6IG51bWJlcixcbiAgcHJvbXB0OiBzdHJpbmcsXG4gIHNjZW5lOiBTdG9yeWJvYXJkU2NlbmUsXG4gIHJlZmVyZW5jZXM6IEJ1ZmZlcltdLFxuICByZWZlcmVuY2VJbmRpY2VzOiBudW1iZXJbXSxcbiAgYXNwZWN0UmF0aW86IFZpZGVvQXNwZWN0UmF0aW8sXG4gIHF1YWxpdHk6ICcxMDgwcCcgfCAnNGsnLFxuICBuYXRpdmVBdWRpbzogYm9vbGVhbixcbiAgb25TdGF0dXM/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLFxuICBzaG91bGRDYW5jZWw/OiAoKSA9PiBQcm9taXNlPGJvb2xlYW4+LFxuICBkZWFkbGluZUF0PzogbnVtYmVyLFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgY2hhaW4gPSBnZW1pbmlNb2RlbENoYWluKCk7XG4gIGxldCBsYXN0RXJyb3I6IHVua25vd247XG4gIGZvciAoY29uc3QgW2NoYWluSW5kZXgsIG1vZGVsXSBvZiBjaGFpbi5lbnRyaWVzKCkpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGdlbmVyYXRlR2VtaW5pU2NlbmVXaXRoTW9kZWwoXG4gICAgICAgIGpvYklkLCBzY2VuZUluZGV4LCBwcm9tcHQsIHNjZW5lLCByZWZlcmVuY2VzLCByZWZlcmVuY2VJbmRpY2VzLFxuICAgICAgICBhc3BlY3RSYXRpbywgcXVhbGl0eSwgbmF0aXZlQXVkaW8sIG1vZGVsLCBvblN0YXR1cywgc2hvdWxkQ2FuY2VsLCBkZWFkbGluZUF0LFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbGFzdEVycm9yID0gZXJyb3I7XG4gICAgICBjb25zdCBuZXh0TW9kZWwgPSBjaGFpbltjaGFpbkluZGV4ICsgMV07XG4gICAgICBpZiAoIW5leHRNb2RlbCkgdGhyb3cgZXJyb3I7XG4gICAgICBjb25zdCBtZXNzYWdlID0gKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIHx8IFN0cmluZyhlcnJvcik7XG4gICAgICBjb25zb2xlLndhcm4oYFthaS12aWRlb10gam9iPSR7am9iSWR9IHNjZW5lPSR7c2NlbmVJbmRleCArIDF9IHByb3ZpZGVyPWdlbWluaSBtb2RlbD0ke21vZGVsfSBleGhhdXN0ZWQsIHRyeWluZyBtb2RlbD0ke25leHRNb2RlbH06ICR7bWVzc2FnZX1gKTtcbiAgICAgIG9uU3RhdHVzPy4oYFN3aXRjaGluZyBBSSBtb2RlbHMgZm9yIHNjZW5lICR7c2NlbmVJbmRleCArIDF9YCk7XG4gICAgfVxuICB9XG4gIHRocm93IGxhc3RFcnJvcjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVHZW1pbmlTY2VuZVdpdGhNb2RlbChcbiAgam9iSWQ6IHN0cmluZyxcbiAgc2NlbmVJbmRleDogbnVtYmVyLFxuICBwcm9tcHQ6IHN0cmluZyxcbiAgc2NlbmU6IFN0b3J5Ym9hcmRTY2VuZSxcbiAgcmVmZXJlbmNlczogQnVmZmVyW10sXG4gIHJlZmVyZW5jZUluZGljZXM6IG51bWJlcltdLFxuICBhc3BlY3RSYXRpbzogVmlkZW9Bc3BlY3RSYXRpbyxcbiAgcXVhbGl0eTogJzEwODBwJyB8ICc0aycsXG4gIG5hdGl2ZUF1ZGlvOiBib29sZWFuLFxuICBtb2RlbDogc3RyaW5nLFxuICBvblN0YXR1cz86IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQsXG4gIHNob3VsZENhbmNlbD86ICgpID0+IFByb21pc2U8Ym9vbGVhbj4sXG4gIGRlYWRsaW5lQXQ/OiBudW1iZXIsXG4pIHtcbiAgY29uc3QgY2xpZW50ID0gZ2V0R2VtaW5pQ2xpZW50KCk7XG4gIGNvbnN0IHNlbGVjdGVkID0gcmVmZXJlbmNlSW5kaWNlcy5tYXAoKGluZGV4KSA9PiByZWZlcmVuY2VzW2luZGV4XSkuZmlsdGVyKEJvb2xlYW4pO1xuICBpZiAoIXNlbGVjdGVkLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdObyB3ZWJzaXRlIHNjcmVlbnNob3QgaXMgYXZhaWxhYmxlIGZvciBBSSB2aWRlbyBncm91bmRpbmcuJyk7XG5cbiAgY29uc3QgYXBpQXNwZWN0ID0gcHJvdmlkZXJBc3BlY3RSYXRpbyhhc3BlY3RSYXRpbyk7XG4gIGNvbnN0IHByaW1hcnkgPSBpbWFnZUZyb21CdWZmZXIoc2VsZWN0ZWRbMF0pO1xuICBjb25zdCBpc1N0YXRlVHJhbnNpdGlvbiA9IFsnaW50ZXJhY3Rpb24nXS5pbmNsdWRlcyhzY2VuZS5zY2VuZVR5cGUpICYmIHNlbGVjdGVkLmxlbmd0aCA+PSAyO1xuICBjb25zdCBjb25maWcgPSBidWlsZEdlbWluaVZpZGVvQ29uZmlnKFxuICAgIGFwaUFzcGVjdCxcbiAgICBxdWFsaXR5LFxuICAgIGlzU3RhdGVUcmFuc2l0aW9uLFxuICAgIGlzU3RhdGVUcmFuc2l0aW9uID8gaW1hZ2VGcm9tQnVmZmVyKHNlbGVjdGVkW3NlbGVjdGVkLmxlbmd0aCAtIDFdKSA6IHVuZGVmaW5lZCxcbiAgKTtcblxuICAvLyBWZW8ncyBpbWFnZS10by12aWRlbyBwYXRoIHVzZXMgdGhlIHJlYWwgc2NyZWVuc2hvdCBhcyB0aGUgZXhhY3QgZmlyc3RcbiAgLy8gZnJhbWUuIEludGVyYWN0aW9uIHNjZW5lcyBhZGRpdGlvbmFsbHkgdXNlIGEgY2FwdHVyZWQgcmVhbCBhZnRlci1zdGF0ZSBhc1xuICAvLyBsYXN0RnJhbWUuIFdlIGludGVudGlvbmFsbHkgZG8gbm90IGNvbWJpbmUgaW1hZ2UgKyByZWZlcmVuY2VJbWFnZXMgaGVyZTpcbiAgLy8gZmlyc3QvbGFzdC1mcmFtZSBpbnRlcnBvbGF0aW9uIGdpdmVzIHdlYnNpdGUgVUkgdGhlIHN0cm9uZ2VzdCBncm91bmRpbmdcbiAgLy8gYW5kIGZvbGxvd3MgR29vZ2xlJ3MgZG9jdW1lbnRlZCBWZW8gMy4xIHJlcXVlc3Qgc2hhcGVzLlxuXG4gIGNvbnNvbGUuaW5mbyhgW2FpLXZpZGVvXSBqb2I9JHtqb2JJZH0gc2NlbmU9JHtzY2VuZUluZGV4ICsgMX0gcHJvdmlkZXI9Z2VtaW5pIG1vZGVsPSR7bW9kZWx9IHJlZnM9JHtzZWxlY3RlZC5sZW5ndGh9IHRyYW5zaXRpb25fZnJhbWVzPSR7aXNTdGF0ZVRyYW5zaXRpb259IGF1ZGlvX3JlcXVlc3RlZD0ke25hdGl2ZUF1ZGlvfSAoZ2VuZXJhdGVBdWRpbyBwYXJhbSBvbWl0dGVkIFx1MjAxNCBEZXZlbG9wZXIgQVBJIHJlamVjdHMgaXQ7IGFjdHVhbCBhdWRpbyBpcyB2ZXJpZmllZCBhZnRlciBkb3dubG9hZClgKTtcbiAgb25TdGF0dXM/LihgU3VibWl0dGluZyBBSSBzY2VuZSAke3NjZW5lSW5kZXggKyAxfSB0byBWZW9gKTtcblxuICAvLyBAZ29vZ2xlL2dlbmFpIG5vdyBwcmVmZXJzIHRoZSBjb25zb2xpZGF0ZWQgYHNvdXJjZWAgYXJndW1lbnQuIFVzaW5nIGl0XG4gIC8vIGF2b2lkcyB0aGUgU0RLIGRlcHJlY2F0aW9uIHdhcm5pbmcgZW1pdHRlZCBieSBwcm9tcHQvaW1hZ2UgdG9wLWxldmVsXG4gIC8vIGFyZ3VtZW50cy4gSU1QT1JUQU5UOiBkbyBub3Qgc2VuZCBgc2VlZGAgdG8gR2VtaW5pIERldmVsb3BlciBBUEkgVmVvO1xuICAvLyB0aGF0IGZpZWxkIGlzIGN1cnJlbnRseSByZWplY3RlZCBvdXRzaWRlIHRoZSBFbnRlcnByaXNlIEFnZW50IFBsYXRmb3JtLlxuICBsZXQgb3BlcmF0aW9uOiBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIGNsaWVudC5tb2RlbHMuZ2VuZXJhdGVWaWRlb3M+PiB8IHVuZGVmaW5lZDtcbiAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IDsgYXR0ZW1wdCsrKSB7XG4gICAgdHJ5IHtcbiAgICAgIG9wZXJhdGlvbiA9IGF3YWl0IGNsaWVudC5tb2RlbHMuZ2VuZXJhdGVWaWRlb3Moe1xuICAgICAgICBtb2RlbCxcbiAgICAgICAgc291cmNlOiB7IHByb21wdCwgaW1hZ2U6IHByaW1hcnkgfSxcbiAgICAgICAgY29uZmlnLFxuICAgICAgfSBhcyBuZXZlcik7XG4gICAgICBicmVhaztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB8fCBTdHJpbmcoZXJyb3IpO1xuICAgICAgY29uc3QgcmV0cnlEZWxheU1zID0gR0VNSU5JX1JFVFJZX0RFTEFZU19NU1thdHRlbXB0XTtcbiAgICAgIGNvbnN0IGNhblJldHJ5ID0gaXNSZXRyeWFibGVHZW1pbmlFcnJvcihtZXNzYWdlKSAmJiByZXRyeURlbGF5TXMgIT09IHVuZGVmaW5lZFxuICAgICAgICAmJiAoIWRlYWRsaW5lQXQgfHwgRGF0ZS5ub3coKSArIHJldHJ5RGVsYXlNcyA8IGRlYWRsaW5lQXQpXG4gICAgICAgICYmICEoc2hvdWxkQ2FuY2VsICYmIGF3YWl0IHNob3VsZENhbmNlbCgpKTtcbiAgICAgIGlmICghY2FuUmV0cnkpIHRocm93IGVycm9yO1xuICAgICAgY29uc29sZS53YXJuKGBbYWktdmlkZW9dIGpvYj0ke2pvYklkfSBzY2VuZT0ke3NjZW5lSW5kZXggKyAxfSBwcm92aWRlcj1nZW1pbmkgcmF0ZV9saW1pdGVkLCByZXRyeWluZyBpbiAke01hdGgucm91bmQocmV0cnlEZWxheU1zIC8gMTAwMCl9cyAoYXR0ZW1wdCAke2F0dGVtcHQgKyAyfS8ke0dFTUlOSV9SRVRSWV9ERUxBWVNfTVMubGVuZ3RoICsgMX0pOiAke21lc3NhZ2V9YCk7XG4gICAgICBvblN0YXR1cz8uKGBWZW8gaXMgdGVtcG9yYXJpbHkgYnVzeSBcdTIwMTQgcmV0cnlpbmcgc2NlbmUgJHtzY2VuZUluZGV4ICsgMX0gc2hvcnRseWApO1xuICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgcmV0cnlEZWxheU1zKSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgb3BlcmF0aW9uTmFtZSA9IHR5cGVvZiAob3BlcmF0aW9uIGFzIHsgbmFtZT86IHVua25vd24gfSkubmFtZSA9PT0gJ3N0cmluZydcbiAgICA/IFN0cmluZygob3BlcmF0aW9uIGFzIHsgbmFtZT86IHN0cmluZyB9KS5uYW1lKVxuICAgIDogJ3Vua25vd24nO1xuICBjb25zdCBzdGFydGVkID0gRGF0ZS5ub3coKTtcbiAgbGV0IGxhc3RQb2xsTG9nQXQgPSAwO1xuICBjb25zb2xlLmluZm8oYFthaS12aWRlb10gam9iPSR7am9iSWR9IHNjZW5lPSR7c2NlbmVJbmRleCArIDF9IHByb3ZpZGVyPWdlbWluaSBzdWJtaXR0ZWQgb3BlcmF0aW9uPSR7b3BlcmF0aW9uTmFtZX1gKTtcblxuICB3aGlsZSAoIW9wZXJhdGlvbi5kb25lKSB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBlbGFwc2VkTXMgPSBub3cgLSBzdGFydGVkO1xuICAgIGlmIChkZWFkbGluZUF0ICYmIG5vdyA+PSBkZWFkbGluZUF0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFJIHZpZGVvIGdlbmVyYXRpb24gZXhjZWVkZWQgdGhlIG92ZXJhbGwgcHJvZHVjdGlvbiB0aW1lb3V0IHdoaWxlIHdhaXRpbmcgZm9yIHNjZW5lICR7c2NlbmVJbmRleCArIDF9LmApO1xuICAgIH1cbiAgICBpZiAoZWxhcHNlZE1zID4gR0VORVJBVElPTl9USU1FT1VUX01TKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEdlbWluaSB2aWRlbyBnZW5lcmF0aW9uIHRpbWVkIG91dCBmb3Igc2NlbmUgJHtzY2VuZUluZGV4ICsgMX0gYWZ0ZXIgJHtNYXRoLnJvdW5kKGVsYXBzZWRNcyAvIDEwMDApfXMuYCk7XG4gICAgfVxuICAgIGlmIChzaG91bGRDYW5jZWwgJiYgYXdhaXQgc2hvdWxkQ2FuY2VsKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQUkgdmlkZW8gZ2VuZXJhdGlvbiB3YXMgY2FuY2VsbGVkIGJ5IHRoZSB1c2VyLicpO1xuICAgIH1cbiAgICBpZiAobm93IC0gbGFzdFBvbGxMb2dBdCA+PSBQT0xMX0xPR19NUykge1xuICAgICAgbGFzdFBvbGxMb2dBdCA9IG5vdztcbiAgICAgIGNvbnN0IGVsYXBzZWRTZWNvbmRzID0gTWF0aC5yb3VuZChlbGFwc2VkTXMgLyAxMDAwKTtcbiAgICAgIGNvbnNvbGUuaW5mbyhgW2FpLXZpZGVvXSBqb2I9JHtqb2JJZH0gc2NlbmU9JHtzY2VuZUluZGV4ICsgMX0gcHJvdmlkZXI9Z2VtaW5pIHdhaXRpbmcgZWxhcHNlZD0ke2VsYXBzZWRTZWNvbmRzfXMgb3BlcmF0aW9uPSR7b3BlcmF0aW9uTmFtZX1gKTtcbiAgICAgIG9uU3RhdHVzPy4oYEdlbmVyYXRpbmcgQUkgc2NlbmUgJHtzY2VuZUluZGV4ICsgMX0gXHUwMEI3ICR7ZWxhcHNlZFNlY29uZHN9cyBlbGFwc2VkYCk7XG4gICAgfVxuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIFBPTExfTVMpKTtcbiAgICBvcGVyYXRpb24gPSBhd2FpdCBjbGllbnQub3BlcmF0aW9ucy5nZXRWaWRlb3NPcGVyYXRpb24oeyBvcGVyYXRpb24gfSBhcyBuZXZlcik7XG4gIH1cbiAgaWYgKG9wZXJhdGlvbi5lcnJvcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgR2VtaW5pIHZpZGVvIGdlbmVyYXRpb24gZmFpbGVkIGZvciBzY2VuZSAke3NjZW5lSW5kZXggKyAxfTogJHtKU09OLnN0cmluZ2lmeShvcGVyYXRpb24uZXJyb3IpfWApO1xuICB9XG5cbiAgY29uc3QgdmlkZW8gPSBvcGVyYXRpb24ucmVzcG9uc2U/LmdlbmVyYXRlZFZpZGVvcz8uWzBdPy52aWRlbztcbiAgaWYgKCF2aWRlbykgdGhyb3cgbmV3IEVycm9yKGBHZW1pbmkgcmV0dXJuZWQgbm8gdmlkZW8gZm9yIHNjZW5lICR7c2NlbmVJbmRleCArIDF9LmApO1xuICBjb25zdCBkaXIgPSBwYXRoLmpvaW4oQVNTRVRTX0RJUiwgam9iSWQpO1xuICBhd2FpdCBmcy5ta2RpcihkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBjb25zdCBvdXRwdXQgPSBwYXRoLmpvaW4oZGlyLCBgYWktc2NlbmUtJHtzY2VuZUluZGV4ICsgMX0tZ2VtaW5pLm1wNGApO1xuICBvblN0YXR1cz8uKGBEb3dubG9hZGluZyBjb21wbGV0ZWQgQUkgc2NlbmUgJHtzY2VuZUluZGV4ICsgMX1gKTtcbiAgYXdhaXQgY2xpZW50LmZpbGVzLmRvd25sb2FkKHsgZmlsZTogdmlkZW8sIGRvd25sb2FkUGF0aDogb3V0cHV0IH0gYXMgbmV2ZXIpO1xuICBjb25zdCBzZWNvbmRzID0gYXdhaXQgZHVyYXRpb24ob3V0cHV0KTtcbiAgY29uc3Qgc3RhdCA9IGF3YWl0IGZzLnN0YXQob3V0cHV0KTtcbiAgY29uc3QgcHJvdmlkZXJSYXRlID0gbW9kZWwuaW5jbHVkZXMoJ2xpdGUnKVxuICAgID8gKHF1YWxpdHkgPT09ICc0aycgPyAwIDogR0VNSU5JX0NPU1RfQ0FUQUxPRy52aWRlby5saXRlMTA4MClcbiAgICA6IG1vZGVsLmluY2x1ZGVzKCdmYXN0JylcbiAgICAgID8gKHF1YWxpdHkgPT09ICc0aycgPyBHRU1JTklfQ09TVF9DQVRBTE9HLnZpZGVvLmZhc3Q0ayA6IEdFTUlOSV9DT1NUX0NBVEFMT0cudmlkZW8uZmFzdDEwODApXG4gICAgICA6IChxdWFsaXR5ID09PSAnNGsnID8gR0VNSU5JX0NPU1RfQ0FUQUxPRy52aWRlby5zdGFuZGFyZDRrIDogR0VNSU5JX0NPU1RfQ0FUQUxPRy52aWRlby5zdGFuZGFyZDEwODApO1xuICBhd2FpdCByZWNvcmRHZW5lcmF0aW9uQ29zdCh7XG4gICAgam9iSWQsIHByb3ZpZGVyOiAnZ2VtaW5pJywgbW9kZWwsIG9wZXJhdGlvbjogJ3ZpZGVvX3NjZW5lJyxcbiAgICBxdWFudGl0eTogc2Vjb25kcywgdW5pdDogJ2dlbmVyYXRlZF9zZWNvbmQnLCB1bml0Q29zdFVzZDogcHJvdmlkZXJSYXRlLFxuICAgIG1ldGFkYXRhOiB7IHNjZW5lOiBzY2VuZUluZGV4ICsgMSwgcXVhbGl0eSB9LFxuICB9KTtcbiAgY29uc29sZS5pbmZvKGBbYWktdmlkZW9dIGpvYj0ke2pvYklkfSBzY2VuZT0ke3NjZW5lSW5kZXggKyAxfSBwcm92aWRlcj1nZW1pbmkgY29tcGxldGVkIGVsYXBzZWQ9JHtNYXRoLnJvdW5kKChEYXRlLm5vdygpIC0gc3RhcnRlZCkgLyAxMDAwKX1zIGR1cmF0aW9uPSR7c2Vjb25kcy50b0ZpeGVkKDIpfXMgYnl0ZXM9JHtzdGF0LnNpemV9YCk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZUNsaXAoXG4gIGlucHV0OiBzdHJpbmcsXG4gIG91dHB1dDogc3RyaW5nLFxuICBhc3BlY3RSYXRpbzogVmlkZW9Bc3BlY3RSYXRpbyxcbiAgcXVhbGl0eTogJzEwODBwJyB8ICc0aycsXG4gIGZyYW1lUmF0ZTogMzAgfCA2MCxcbikge1xuICBjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IG91dHB1dEZyYW1lKGFzcGVjdFJhdGlvLCBxdWFsaXR5KTtcbiAgY29uc3Qgc291cmNlSGFzQXVkaW8gPSBhd2FpdCBoYXNBdWRpbyhpbnB1dCk7XG4gIGNvbnN0IHNjYWxlQ3JvcCA9IGBzY2FsZT0ke3dpZHRofToke2hlaWdodH06Zm9yY2Vfb3JpZ2luYWxfYXNwZWN0X3JhdGlvPWluY3JlYXNlLGNyb3A9JHt3aWR0aH06JHtoZWlnaHR9LHNldHNhcj0xLGZwcz0ke2ZyYW1lUmF0ZX1gO1xuICBjb25zdCBhcmdzID0gWycteScsICctaGlkZV9iYW5uZXInLCAnLWxvZ2xldmVsJywgJ2Vycm9yJywgJy1pJywgaW5wdXRdO1xuICBpZiAoIXNvdXJjZUhhc0F1ZGlvKSBhcmdzLnB1c2goJy1mJywgJ2xhdmZpJywgJy1pJywgJ2FudWxsc3JjPWNoYW5uZWxfbGF5b3V0PXN0ZXJlbzpzYW1wbGVfcmF0ZT00ODAwMCcpO1xuICBhcmdzLnB1c2goXG4gICAgJy12ZicsIHNjYWxlQ3JvcCxcbiAgICAnLWM6dicsICdsaWJ4MjY0JywgJy1wcmVzZXQnLCAnZmFzdCcsICctY3JmJywgcXVhbGl0eSA9PT0gJzRrJyA/ICcxNycgOiAnMTgnLCAnLXBpeF9mbXQnLCAneXV2NDIwcCcsXG4gICAgJy1jOmEnLCAnYWFjJywgJy1iOmEnLCAnMTkyaycsICctYXInLCAnNDgwMDAnLCAnLWFjJywgJzInLFxuICAgIC4uLihzb3VyY2VIYXNBdWRpbyA/IFtdIDogWyctc2hvcnRlc3QnXSksXG4gICAgJy1tb3ZmbGFncycsICcrZmFzdHN0YXJ0Jywgb3V0cHV0LFxuICApO1xuICBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZm1wZWcnLCBhcmdzLCB7IHRpbWVvdXQ6IDE1ICogNjBfMDAwLCBtYXhCdWZmZXI6IDggKiAxMDI0ICogMTAyNCB9KTtcbiAgYXdhaXQgZHVyYXRpb24ob3V0cHV0KTtcbiAgcmV0dXJuIHNvdXJjZUhhc0F1ZGlvO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjb25jYXRDbGlwcyhqb2JJZDogc3RyaW5nLCBjbGlwczogc3RyaW5nW10pIHtcbiAgY29uc3QgZGlyID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkKTtcbiAgY29uc3QgbGlzdCA9IHBhdGguam9pbihkaXIsICdhaS1zY2VuZXMuY29uY2F0LnR4dCcpO1xuICBjb25zdCBlc2MgPSAodmFsdWU6IHN0cmluZykgPT4gdmFsdWUucmVwbGFjZSgvJy9nLCBcIidcXFxcJydcIik7XG4gIGF3YWl0IGZzLndyaXRlRmlsZShsaXN0LCBjbGlwcy5tYXAoKGNsaXApID0+IGBmaWxlICcke2VzYyhjbGlwKX0nYCkuam9pbignXFxuJykpO1xuICBjb25zdCBvdXRwdXQgPSBwYXRoLmpvaW4oZGlyLCAnYWktdmlkZW8tbWFzdGVyLXNvdXJjZS5tcDQnKTtcbiAgYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZtcGVnJywgW1xuICAgICcteScsICctaGlkZV9iYW5uZXInLCAnLWxvZ2xldmVsJywgJ2Vycm9yJywgJy1mJywgJ2NvbmNhdCcsICctc2FmZScsICcwJywgJy1pJywgbGlzdCxcbiAgICAnLWMnLCAnY29weScsICctbW92ZmxhZ3MnLCAnK2Zhc3RzdGFydCcsIG91dHB1dCxcbiAgXSwgeyB0aW1lb3V0OiAxNSAqIDYwXzAwMCwgbWF4QnVmZmVyOiA4ICogMTAyNCAqIDEwMjQgfSk7XG4gIGF3YWl0IGR1cmF0aW9uKG91dHB1dCk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5pc2hBdWRpbyhcbiAgc291cmNlOiBzdHJpbmcsXG4gIG91dHB1dDogc3RyaW5nLFxuICBzaWxlbnQ6IGJvb2xlYW4sXG4gIG5hcnJhdGlvblBhdGg6IHN0cmluZyB8IG51bGwsXG4gIG5hdGl2ZUF1ZGlvUHJlc2VudDogYm9vbGVhbixcbikge1xuICBpZiAoc2lsZW50KSB7XG4gICAgYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZtcGVnJywgW1xuICAgICAgJy15JywgJy1oaWRlX2Jhbm5lcicsICctbG9nbGV2ZWwnLCAnZXJyb3InLCAnLWknLCBzb3VyY2UsXG4gICAgICAnLW1hcCcsICcwOnY6MCcsICctYzp2JywgJ2NvcHknLCAnLWFuJywgJy1tb3ZmbGFncycsICcrZmFzdHN0YXJ0Jywgb3V0cHV0LFxuICAgIF0sIHsgdGltZW91dDogMTAgKiA2MF8wMDAsIG1heEJ1ZmZlcjogOCAqIDEwMjQgKiAxMDI0IH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChuYXJyYXRpb25QYXRoKSB7XG4gICAgLy8gVFRTIHRpbWluZyBjYW4gbGVnaXRpbWF0ZWx5IHJ1biBsb25nZXIgdGhhbiB0aGUgc2NyaXB0ZWQgdGFyZ2V0LCBhbmQgdGhlXG4gICAgLy8gYXNzZW1ibGVkIEFJIGNsaXBzIGhhdmUgYSBmaXhlZCB0b3RhbCBsZW5ndGguIE5ldmVyIHNvbHZlIHRoYXQgbWlzbWF0Y2hcbiAgICAvLyBieSBjdXR0aW5nIHRoZSBuYXJyYXRpb24gc2hvcnQgd2l0aCAtc2hvcnRlc3QgXHUyMDE0IGZyZWV6ZSB0aGUgZmluYWwgZnJhbWVcbiAgICAvLyBpbnN0ZWFkIHNvIHRoZSB2b2ljZW92ZXIgYWx3YXlzIGZpbmlzaGVzIHNwZWFraW5nLlxuICAgIGNvbnN0IFt2aWRlb1NlY29uZHMsIG5hcnJhdGlvblNlY29uZHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgZHVyYXRpb24oc291cmNlKSxcbiAgICAgIGR1cmF0aW9uKG5hcnJhdGlvblBhdGgpLmNhdGNoKCgpID0+IDApLFxuICAgIF0pO1xuICAgIGNvbnN0IGV4dGVuZFNlY29uZHMgPSBuYXJyYXRpb25TZWNvbmRzID4gdmlkZW9TZWNvbmRzICsgMC4yNSA/IG5hcnJhdGlvblNlY29uZHMgLSB2aWRlb1NlY29uZHMgOiAwO1xuICAgIGNvbnN0IHZpZGVvTGFiZWwgPSBleHRlbmRTZWNvbmRzID4gMCA/ICdbdl0nIDogJzA6djowJztcbiAgICAvLyBCb3RoIGF1ZGlvIGxlZ3MgYXJlIHBhZGRlZCB0byB0aGUgU0FNRSBib3VuZGVkIHRhcmdldCBkdXJhdGlvbiBiZWZvcmVcbiAgICAvLyBtaXhpbmcsIHNvIG5laXRoZXIgYW1peCBpbnB1dCBjYW4gZW5kIGVhcmx5IGFuZCBjdXQgdGhlIG90aGVyIG9mZi5cbiAgICAvLyBJTVBPUlRBTlQ6IGFwYWQgbXVzdCBiZSBib3VuZGVkIHdpdGggd2hvbGVfZHVyIGhlcmUgXHUyMDE0IGFwYWQgd2l0aCBub1xuICAgIC8vIGJvdW5kIHBhZHMgZm9yZXZlciwgYW5kIHR3byB1bmJvdW5kZWQgYXBhZHMgZmVlZGluZyBhbWl4IGJ1aWxkcyBhblxuICAgIC8vIGluZmluaXRlIGZpbHRlciBncmFwaCB0aGF0IGZmbXBlZyBjYW5ub3QgbWF0ZXJpYWxpemUgKGl0IGZhaWxzIHdpdGggYVxuICAgIC8vIG1pc2xlYWRpbmcgXCJObyBzcGFjZSBsZWZ0IG9uIGRldmljZVwiIHJhdGhlciB0aGFuIGEgY2xlYXIgZmlsdGVyIGVycm9yKS5cbiAgICBjb25zdCB0YXJnZXRTZWNvbmRzID0gTWF0aC5tYXgodmlkZW9TZWNvbmRzLCBuYXJyYXRpb25TZWNvbmRzKS50b0ZpeGVkKDIpO1xuICAgIC8vIEtlZXAgdGhlIEFJIG1vZGVsJ3Mgb3duIG11c2ljL2FtYmllbmNlL1VJIGVmZmVjdHMgYXMgYSBxdWlldCBiZWQgYW5kIHB1dFxuICAgIC8vIG5hcnJhdGlvbiBjbGVhcmx5IGFib3ZlIGl0LiBJZiB0aGUgcHJvdmlkZXIgZ2VuZXJhdGVkIG5vIG1lYW5pbmdmdWxcbiAgICAvLyBhdWRpbywgdGhlIG5vcm1hbGl6ZWQgc2lsZW50IGJlZCBzaW1wbHkgY29udHJpYnV0ZXMgbm90aGluZyBhdWRpYmxlLlxuICAgIGNvbnN0IGZpbHRlcnMgPSBbXG4gICAgICAuLi4oZXh0ZW5kU2Vjb25kcyA+IDAgPyBbYFswOnZddHBhZD1zdG9wX21vZGU9Y2xvbmU6c3RvcF9kdXJhdGlvbj0ke2V4dGVuZFNlY29uZHMudG9GaXhlZCgyKX1bdl1gXSA6IFtdKSxcbiAgICAgIG5hdGl2ZUF1ZGlvUHJlc2VudFxuICAgICAgICA/IGBbMDphXXZvbHVtZT0wLjMyLGFwYWQ9d2hvbGVfZHVyPSR7dGFyZ2V0U2Vjb25kc31bYmVkXTtbMTphXXZvbHVtZT0xLjAsYXBhZD13aG9sZV9kdXI9JHt0YXJnZXRTZWNvbmRzfVt2b2ljZV07W2JlZF1bdm9pY2VdYW1peD1pbnB1dHM9MjpkdXJhdGlvbj1maXJzdDpkcm9wb3V0X3RyYW5zaXRpb249MlthXWBcbiAgICAgICAgOiBgWzE6YV12b2x1bWU9MS4wLGFwYWQ9d2hvbGVfZHVyPSR7dGFyZ2V0U2Vjb25kc31bYV1gLFxuICAgIF07XG4gICAgYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZtcGVnJywgW1xuICAgICAgJy15JywgJy1oaWRlX2Jhbm5lcicsICctbG9nbGV2ZWwnLCAnZXJyb3InLCAnLWknLCBzb3VyY2UsICctaScsIG5hcnJhdGlvblBhdGgsXG4gICAgICAnLWZpbHRlcl9jb21wbGV4JywgZmlsdGVycy5qb2luKCc7JyksXG4gICAgICAnLW1hcCcsIHZpZGVvTGFiZWwsICctbWFwJywgJ1thXScsXG4gICAgICAnLWM6dicsIGV4dGVuZFNlY29uZHMgPiAwID8gJ2xpYngyNjQnIDogJ2NvcHknLCAuLi4oZXh0ZW5kU2Vjb25kcyA+IDAgPyBbJy1wcmVzZXQnLCAnZmFzdCcsICctY3JmJywgJzE4JywgJy1waXhfZm10JywgJ3l1djQyMHAnXSA6IFtdKSxcbiAgICAgICctYzphJywgJ2FhYycsICctYjphJywgJzE5MmsnLCAnLWFyJywgJzQ4MDAwJyxcbiAgICAgICctc2hvcnRlc3QnLCAnLW1vdmZsYWdzJywgJytmYXN0c3RhcnQnLCBvdXRwdXQsXG4gICAgXSwgeyB0aW1lb3V0OiAxMCAqIDYwXzAwMCwgbWF4QnVmZmVyOiA4ICogMTAyNCAqIDEwMjQgfSk7XG4gICAgaWYgKGV4dGVuZFNlY29uZHMgPiAwKSB7XG4gICAgICBjb25zb2xlLmluZm8oYFthaS12aWRlb10gbmFycmF0aW9uICR7bmFycmF0aW9uU2Vjb25kcy50b0ZpeGVkKDEpfXMgZXhjZWVkZWQgYXNzZW1ibGVkIHZpZGVvICR7dmlkZW9TZWNvbmRzLnRvRml4ZWQoMSl9cyBcdTIwMTQgaGVsZCBmaW5hbCBmcmFtZSBmb3IgJHtleHRlbmRTZWNvbmRzLnRvRml4ZWQoMSl9cyBpbnN0ZWFkIG9mIGN1dHRpbmcgbmFycmF0aW9uYCk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGF3YWl0IGZzLmNvcHlGaWxlKHNvdXJjZSwgb3V0cHV0KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZU11c2ljT25seUJlZChqb2JJZDogc3RyaW5nLCBzZWNvbmRzOiBudW1iZXIpIHtcbiAgY29uc3Qgb3V0cHV0ID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkLCAnbXVzaWMtb25seS1iZWQubTRhJyk7XG4gIGNvbnN0IGNvbmZpZ3VyZWQgPSBwcm9jZXNzLmVudi5CQUNLR1JPVU5EX01VU0lDX1BBVEg/LnRyaW0oKTtcbiAgaWYgKGNvbmZpZ3VyZWQpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKGNvbmZpZ3VyZWQpO1xuICAgICAgYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZtcGVnJywgW1xuICAgICAgICAnLXknLCAnLWhpZGVfYmFubmVyJywgJy1sb2dsZXZlbCcsICdlcnJvcicsICctc3RyZWFtX2xvb3AnLCAnLTEnLCAnLWknLCBjb25maWd1cmVkLFxuICAgICAgICAnLXQnLCBzZWNvbmRzLnRvRml4ZWQoMyksICctdm4nLCAnLWFmJywgYHZvbHVtZT0wLjQ4LGFmYWRlPXQ9aW46c3Q9MDpkPTAuOCxhZmFkZT10PW91dDpzdD0ke01hdGgubWF4KDAsIHNlY29uZHMgLSAxLjIpLnRvRml4ZWQoMyl9OmQ9MS4yYCxcbiAgICAgICAgJy1jOmEnLCAnYWFjJywgJy1iOmEnLCAnMTkyaycsICctYXInLCAnNDgwMDAnLCBvdXRwdXQsXG4gICAgICBdLCB7IHRpbWVvdXQ6IDUgKiA2MF8wMDAsIG1heEJ1ZmZlcjogOCAqIDEwMjQgKiAxMDI0IH0pO1xuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGBbYXVkaW9dIGNvbmZpZ3VyZWQgYmFja2dyb3VuZCBtdXNpYyB1bmF2YWlsYWJsZSwgdXNpbmcgZ2VuZXJhdGVkIGluc3RydW1lbnRhbCBiZWQ6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEEgZGV0ZXJtaW5pc3RpYywgcm95YWx0eS1mcmVlIGFtYmllbnQgaW5zdHJ1bWVudGFsIGZhbGxiYWNrLiBJdCBjb250YWluc1xuICAvLyBubyByZWNvcmRlZCB2b2ljZSBvciB2b2NhbCBtb2RlbCwgZ3VhcmFudGVlaW5nIHRoZSBtdXNpYy1vbmx5IGNob2ljZSBpc1xuICAvLyBhY3R1YWxseSBmcmVlIG9mIHRhbGtpbmcgZXZlbiB3aGVuIGFuIEFJLXZpZGVvIHByb3ZpZGVyIHJldHVybnMgZGlhbG9ndWUuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSAnMC4wNDUqc2luKDIqUEkqMjIwKnQpKigwLjcyKzAuMjgqc2luKDIqUEkqMC4wOCp0KSkrMC4wMzAqc2luKDIqUEkqMjc3LjE4KnQpKzAuMDI0KnNpbigyKlBJKjMyOS42Myp0KSswLjAxNCpzaW4oMipQSSo0NDAqdCkqKDAuNSswLjUqc2luKDIqUEkqMC4xMyp0KSknO1xuICBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZm1wZWcnLCBbXG4gICAgJy15JywgJy1oaWRlX2Jhbm5lcicsICctbG9nbGV2ZWwnLCAnZXJyb3InLCAnLWYnLCAnbGF2ZmknLFxuICAgICctaScsIGBhZXZhbHNyYz0ke2V4cHJlc3Npb259fCR7ZXhwcmVzc2lvbn06cz00ODAwMDpkPSR7c2Vjb25kcy50b0ZpeGVkKDMpfWAsXG4gICAgJy1hZicsIGBsb3dwYXNzPWY9NDIwMCxoaWdocGFzcz1mPTkwLGFmYWRlPXQ9aW46c3Q9MDpkPTAuOCxhZmFkZT10PW91dDpzdD0ke01hdGgubWF4KDAsIHNlY29uZHMgLSAxLjIpLnRvRml4ZWQoMyl9OmQ9MS4yYCxcbiAgICAnLWM6YScsICdhYWMnLCAnLWI6YScsICcxOTJrJywgb3V0cHV0LFxuICBdLCB7IHRpbWVvdXQ6IDUgKiA2MF8wMDAsIG1heEJ1ZmZlcjogOCAqIDEwMjQgKiAxMDI0IH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjbGVhbnVwKGpvYklkOiBzdHJpbmcpIHtcbiAgY29uc3QgZGlyID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkKTtcbiAgbGV0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICB0cnkgeyBmaWxlcyA9IGF3YWl0IGZzLnJlYWRkaXIoZGlyKTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICBjb25zdCB0ZW1wb3JhcnkgPSAvXig/OmFpLXNjZW5lLVxcZCstKD86Z2VtaW5pfG5vcm1hbGl6ZWQpXFwubXA0fGdwdS1cXGQrXFwubXA0fGFpLXNjZW5lc1xcLmNvbmNhdFxcLnR4dHxhaS12aWRlby1tYXN0ZXItc291cmNlXFwubXA0fGFpLXZpZGVvLWF1ZGlvLW1peFxcLm1wNHxtdXNpYy1vbmx5LWJlZFxcLm00YXxicmFuZC1uYW1lXFwudHh0KSQvO1xuICBhd2FpdCBQcm9taXNlLmFsbChmaWxlcy5maWx0ZXIoKG5hbWUpID0+IHRlbXBvcmFyeS50ZXN0KG5hbWUpKS5tYXAoKG5hbWUpID0+IGZzLnJtKHBhdGguam9pbihkaXIsIG5hbWUpLCB7IGZvcmNlOiB0cnVlIH0pLmNhdGNoKCgpID0+IHt9KSkpO1xufVxuXG5mdW5jdGlvbiBzYWZlQnJhbmROYW1lKHNpdGVUaXRsZTogc3RyaW5nKSB7XG4gIHJldHVybiBzaXRlVGl0bGUuc3BsaXQoL1t8XFwtXHUyMDEzXHUyMDE0Ol0vKVswXT8ucmVwbGFjZSgvW1xcclxcbl0rL2csICcgJykudHJpbSgpLnNsaWNlKDAsIDgwKSB8fCBzaXRlVGl0bGUuc2xpY2UoMCwgODApO1xufVxuXG4vKipcbiAqIEFkZCBhbiBleGFjdCwgZGV0ZXJtaW5pc3RpYyBpZGVudGl0eSBjYXJkIG92ZXIgdGhlIGZpbmFsIHNlY29uZHMuIFRoZSBBSVxuICogY3JlYXRlcyB0aGUgbW90aW9uOyB0aGlzIGZpbmlzaGluZyBwYXNzIHByb3RlY3RzIHRoZSByZWFsIGNhcHR1cmVkIGljb24gYW5kXG4gKiB3ZWJzaXRlIG5hbWUgZnJvbSBnZW5lcmF0aXZlIHRleHQvbG9nbyBkaXN0b3J0aW9uLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYWRkQnJhbmRDbG9zaW5nT3ZlcmxheShzb3VyY2U6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcsIGpvYklkOiBzdHJpbmcsIHNpdGVUaXRsZTogc3RyaW5nKSB7XG4gIGNvbnN0IGljb25QYXRoID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkLCAnd2Vic2l0ZS1pY29uLmpwZycpO1xuICBhd2FpdCBmcy5hY2Nlc3MoaWNvblBhdGgpO1xuICBjb25zdCBzZWNvbmRzID0gYXdhaXQgZHVyYXRpb24oc291cmNlKTtcbiAgY29uc3Qgc3RhcnQgPSBNYXRoLm1heCgwLCBzZWNvbmRzIC0gTWF0aC5taW4oMy4yLCBNYXRoLm1heCgyLCBzZWNvbmRzICogMC4yOCkpKTtcbiAgY29uc3QgeyBzdGRvdXQ6IGRpbWVuc2lvbnNUZXh0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZnByb2JlJywgW1xuICAgICctdicsICdlcnJvcicsICctc2VsZWN0X3N0cmVhbXMnLCAndjowJywgJy1zaG93X2VudHJpZXMnLCAnc3RyZWFtPXdpZHRoLGhlaWdodCcsICctb2YnLCAnY3N2PXM9eDpwPTAnLCBzb3VyY2UsXG4gIF0pO1xuICBjb25zdCBbd2lkdGgsIGhlaWdodF0gPSBkaW1lbnNpb25zVGV4dC50cmltKCkuc3BsaXQoJ3gnKS5tYXAoTnVtYmVyKTtcbiAgaWYgKCF3aWR0aCB8fCAhaGVpZ2h0KSB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCByZWFkIHRoZSB2aWRlbyBkaW1lbnNpb25zIGZvciB0aGUgYnJhbmRlZCBlbmRpbmcuJyk7XG4gIGNvbnN0IGljb25TaXplID0gTWF0aC5yb3VuZChNYXRoLm1pbih3aWR0aCwgaGVpZ2h0KSAqIDAuMTMpO1xuICBjb25zdCBjYXJkSGVpZ2h0ID0gTWF0aC5yb3VuZChNYXRoLm1pbih3aWR0aCwgaGVpZ2h0KSAqIDAuMjQpO1xuICBjb25zdCBwYWRkaW5nID0gTWF0aC5yb3VuZChjYXJkSGVpZ2h0ICogMC4yMik7XG4gIGNvbnN0IGZvbnRTaXplID0gTWF0aC5yb3VuZChjYXJkSGVpZ2h0ICogMC4yMik7XG4gIGNvbnN0IHRleHRGaWxlID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkLCAnYnJhbmQtbmFtZS50eHQnKTtcbiAgYXdhaXQgZnMud3JpdGVGaWxlKHRleHRGaWxlLCBzYWZlQnJhbmROYW1lKHNpdGVUaXRsZSksICd1dGY4Jyk7XG4gIGNvbnN0IGZvbnRGaWxlID0gcHJvY2Vzcy5lbnYuQlJBTkRfRk9OVF9GSUxFID8/ICcvdXNyL3NoYXJlL2ZvbnRzL3RydWV0eXBlL2RlamF2dS9EZWphVnVTYW5zLUJvbGQudHRmJztcbiAgY29uc3QgZmlsdGVyID0gW1xuICAgIGBbMDp2XWRyYXdib3g9eD0wOnk9aWgtJHtjYXJkSGVpZ2h0fTp3PWl3Omg9JHtjYXJkSGVpZ2h0fTpjb2xvcj0weDEwMGMyMEAwLjgyOnQ9ZmlsbDplbmFibGU9J2d0ZSh0LCR7c3RhcnQudG9GaXhlZCgzKX0pJ1tiYXNlXWAsXG4gICAgYFsxOnZdc2NhbGU9JHtpY29uU2l6ZX06JHtpY29uU2l6ZX06Zm9yY2Vfb3JpZ2luYWxfYXNwZWN0X3JhdGlvPWRlY3JlYXNlW21hcmtdYCxcbiAgICBgW2Jhc2VdW21hcmtdb3ZlcmxheT14PSR7cGFkZGluZ306eT1ILSR7Y2FyZEhlaWdodH0rKCR7Y2FyZEhlaWdodH0taCkvMjplbmFibGU9J2JldHdlZW4odCwke3N0YXJ0LnRvRml4ZWQoMyl9LCR7c2Vjb25kcy50b0ZpeGVkKDMpfSknW3dpdGhtYXJrXWAsXG4gICAgYFt3aXRobWFya11kcmF3dGV4dD1mb250ZmlsZT0ke2ZvbnRGaWxlfTp0ZXh0ZmlsZT0ke3RleHRGaWxlfTpmb250Y29sb3I9d2hpdGU6Zm9udHNpemU9JHtmb250U2l6ZX06eD0ke3BhZGRpbmcgKyBpY29uU2l6ZSArIE1hdGgucm91bmQocGFkZGluZyAqIDAuNyl9Onk9aC0ke2NhcmRIZWlnaHR9KygoJHtjYXJkSGVpZ2h0fS10ZXh0X2gpLzIpOmVuYWJsZT0nYmV0d2Vlbih0LCR7c3RhcnQudG9GaXhlZCgzKX0sJHtzZWNvbmRzLnRvRml4ZWQoMyl9KSdbdl1gLFxuICBdLmpvaW4oJzsnKTtcbiAgYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZtcGVnJywgW1xuICAgICcteScsICctaGlkZV9iYW5uZXInLCAnLWxvZ2xldmVsJywgJ2Vycm9yJywgJy1pJywgc291cmNlLCAnLWxvb3AnLCAnMScsICctaScsIGljb25QYXRoLFxuICAgICctZmlsdGVyX2NvbXBsZXgnLCBmaWx0ZXIsICctbWFwJywgJ1t2XScsICctbWFwJywgJzA6YT8nLCAnLXQnLCBzZWNvbmRzLnRvRml4ZWQoMyksXG4gICAgJy1jOnYnLCAnbGlieDI2NCcsICctcHJlc2V0JywgJ2Zhc3QnLCAnLWNyZicsICcxOCcsICctcGl4X2ZtdCcsICd5dXY0MjBwJywgJy1jOmEnLCAnY29weScsICctbW92ZmxhZ3MnLCAnK2Zhc3RzdGFydCcsIG91dHB1dCxcbiAgXSwgeyB0aW1lb3V0OiAxMCAqIDYwXzAwMCwgbWF4QnVmZmVyOiA4ICogMTAyNCAqIDEwMjQgfSk7XG4gIGF3YWl0IGR1cmF0aW9uKG91dHB1dCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZU1hcmtldGluZ1ZpZGVvKFxuICBqb2JJZDogc3RyaW5nLFxuICBzaXRlVGl0bGU6IHN0cmluZyxcbiAgc3Rvcnlib2FyZDogUGljazxTdG9yeWJvYXJkLCAnY29uY2VwdCcgfCAndmliZScgfCAnc2NlbmVzJyB8ICdjcmVhdGl2ZUJyaWVmJyB8ICdhc3BlY3RSYXRpbycgfCAnb3V0cHV0UXVhbGl0eScgfCAnZnJhbWVSYXRlJyB8ICd2YXJpYW50U2VlZCc+LFxuICByZWZlcmVuY2VJbWFnZXM6IEJ1ZmZlcltdLFxuICBfc2NyZWVuU3R5bGU6IGJvb2xlYW4sXG4gIGF1ZGlvTW9kZTogQXVkaW9Nb2RlLFxuICBtb2RlID0gJ3ZpZGVvJyxcbiAgb25Qcm9ncmVzcz86IChwZXJjZW50OiBudW1iZXIsIG1lc3NhZ2U/OiBzdHJpbmcsIGV0YVNlY29uZHM/OiBudW1iZXIpID0+IHZvaWQsXG4gIG5hcnJhdGlvbkF1ZGlvUGF0aD86IFByb21pc2U8c3RyaW5nIHwgbnVsbD4gfCBzdHJpbmcgfCBudWxsLFxuICByZWZlcmVuY2VMYWJlbHM6IHN0cmluZ1tdID0gW10sXG4gIHNob3VsZENhbmNlbD86ICgpID0+IFByb21pc2U8Ym9vbGVhbj4sXG4pOiBQcm9taXNlPEdlbmVyYXRlZFZpZGVvPiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc2lsZW50ID0gYXVkaW9Nb2RlID09PSAnc2lsZW50JztcbiAgICBjb25zdCBtdXNpY09ubHkgPSBhdWRpb01vZGUgPT09ICdtdXNpY19vbmx5JztcbiAgICBjb25zdCBzY2VuZXMgPSAoc3Rvcnlib2FyZC5zY2VuZXMgPz8gW10pLnNsaWNlKDAsIDMwKTtcbiAgICBpZiAoIXNjZW5lcy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcignU3Rvcnlib2FyZCBoYXMgbm8gc2NlbmVzLicpO1xuICAgIGlmICghcmVmZXJlbmNlSW1hZ2VzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdObyB3ZWJzaXRlIHNjcmVlbnNob3RzIGFyZSBhdmFpbGFibGUgdG8gZ3JvdW5kIEFJIHZpZGVvIGdlbmVyYXRpb24uJyk7XG5cbiAgICBjb25zdCBwcm92aWRlciA9IGF3YWl0IHJlc29sdmVQcm92aWRlcigndmlkZW8nKTtcbiAgICBjb25zdCBwcm92aWRlclNldHRpbmdzID0gYXdhaXQgZ2V0UHJvdmlkZXJTZXR0aW5ncygpO1xuICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IHByb3ZpZGVyQXZhaWxhYmlsaXR5KCd2aWRlbycpO1xuICAgIGNvbnN0IHByb3ZpZGVyT3JkZXI6IEFycmF5PCdnZW1pbmknIHwgJ29wZW5fc291cmNlJz4gPSBbcHJvdmlkZXJdO1xuICAgIGlmIChwcm92aWRlclNldHRpbmdzLmZhbGxiYWNrRW5hYmxlZCkge1xuICAgICAgY29uc3QgZmFsbGJhY2sgPSBwcm92aWRlciA9PT0gJ2dlbWluaScgPyAnb3Blbl9zb3VyY2UnIDogJ2dlbWluaSc7XG4gICAgICBjb25zdCBmYWxsYmFja1JlYWR5ID0gZmFsbGJhY2sgPT09ICdnZW1pbmknID8gYXZhaWxhYmlsaXR5LmdlbWluaSA6IGF2YWlsYWJpbGl0eS5vcGVuU291cmNlO1xuICAgICAgaWYgKGZhbGxiYWNrUmVhZHkpIHByb3ZpZGVyT3JkZXIucHVzaChmYWxsYmFjayk7XG4gICAgfVxuICAgIGNvbnN0IGFzcGVjdFJhdGlvID0gc3Rvcnlib2FyZC5hc3BlY3RSYXRpbyA/PyAnMTY6OSc7XG4gICAgY29uc3Qgb3V0cHV0UXVhbGl0eSA9IHN0b3J5Ym9hcmQub3V0cHV0UXVhbGl0eSA/PyAnMTA4MHAnO1xuICAgIGNvbnN0IGZyYW1lUmF0ZSA9IHN0b3J5Ym9hcmQuZnJhbWVSYXRlID8/IDMwO1xuICAgIGNvbnN0IHZhcmlhbnRTZWVkID0gTnVtYmVyKHN0b3J5Ym9hcmQudmFyaWFudFNlZWQgPz8gMCk7XG4gICAgY29uc3QgdGFyZ2V0RHVyYXRpb25TZWNvbmRzID0gc2NlbmVzLnJlZHVjZSgoc3VtLCBzY2VuZSkgPT4gc3VtICsgTWF0aC5tYXgoMSwgTnVtYmVyKHNjZW5lLmR1cmF0aW9uU2Vjb25kcyB8fCA4KSksIDApO1xuICAgIGNvbnN0IGdlbmVyYXRpb25TdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGpvYlRvdGFsVGltZW91dE1zID0gdG90YWxHZW5lcmF0aW9uVGltZW91dE1zKHNjZW5lcy5sZW5ndGgpO1xuICAgIGNvbnN0IGRlYWRsaW5lQXQgPSBnZW5lcmF0aW9uU3RhcnRlZEF0ICsgam9iVG90YWxUaW1lb3V0TXM7XG5cbiAgICBjb25zb2xlLmluZm8oYFthaS12aWRlb10gam9iPSR7am9iSWR9IHByb3ZpZGVyPSR7cHJvdmlkZXJ9IG1vZGU9JHttb2RlfSBzY2VuZXM9JHtzY2VuZXMubGVuZ3RofSByZWZzPSR7cmVmZXJlbmNlSW1hZ2VzLmxlbmd0aH0gbmF0aXZlX2FpX2dlbmVyYXRpb249dHJ1ZSBjb2RlX2dlbmVyYXRlZF9tb3Rpb249ZmFsc2UgZmFsbGJhY2tfb3JkZXI9JHtwcm92aWRlck9yZGVyLmpvaW4oJy0+Jyl9IHRvdGFsX3RpbWVvdXRfcz0ke01hdGgucm91bmQoam9iVG90YWxUaW1lb3V0TXMgLyAxMDAwKX1gKTtcblxuICAgIGxldCBjb21wbGV0ZWQgPSAwO1xuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBjb25jdXJyZW50TWFwKHNjZW5lcywgYXN5bmMgKHNjZW5lLCBzY2VuZUluZGV4KSA9PiB7XG4gICAgICBjb25zdCBpbmRpY2VzID0gc2NlbmVSZWZlcmVuY2VJbmRpY2VzKHNjZW5lLCBzY2VuZUluZGV4LCByZWZlcmVuY2VJbWFnZXMubGVuZ3RoKTtcbiAgICAgIGNvbnN0IHNlbGVjdGVkTGFiZWxzID0gaW5kaWNlcy5tYXAoKGluZGV4KSA9PiByZWZlcmVuY2VMYWJlbHNbaW5kZXhdIHx8IGBDQVBUVVJFICR7aW5kZXh9YCk7XG4gICAgICBjb25zdCBwcm9tcHQgPSBidWlsZEFpVmlkZW9TY2VuZVByb21wdCh7XG4gICAgICAgIG1vZGUsXG4gICAgICAgIHNpdGVUaXRsZSxcbiAgICAgICAgY29uY2VwdDogc3Rvcnlib2FyZC5jb25jZXB0ID8/ICdQcm9mZXNzaW9uYWwgd2Vic2l0ZSBmaWxtJyxcbiAgICAgICAgdmliZTogc3Rvcnlib2FyZC52aWJlID8/ICdwcmVtaXVtJyxcbiAgICAgICAgc2NlbmUsXG4gICAgICAgIHNjZW5lSW5kZXgsXG4gICAgICAgIHRvdGFsU2NlbmVzOiBzY2VuZXMubGVuZ3RoLFxuICAgICAgICB0YXJnZXREdXJhdGlvblNlY29uZHMsXG4gICAgICAgIGNyZWF0aXZlQnJpZWY6IHN0b3J5Ym9hcmQuY3JlYXRpdmVCcmllZixcbiAgICAgICAgbmF0aXZlQXVkaW86ICFzaWxlbnQsXG4gICAgICAgIG11c2ljT25seSxcbiAgICAgICAgcmVmZXJlbmNlTGFiZWxzOiBzZWxlY3RlZExhYmVscyxcbiAgICAgICAgdmFyaWFudFNlZWQsXG4gICAgICAgIGFzcGVjdFJhdGlvLFxuICAgICAgICBwcmV2aW91c1NjZW5lU3VtbWFyeTogc2NlbmVzW3NjZW5lSW5kZXggLSAxXT8uc2hvdERlc2NyaXB0aW9uLFxuICAgICAgICBuZXh0U2NlbmVTdW1tYXJ5OiBzY2VuZXNbc2NlbmVJbmRleCArIDFdPy5zaG90RGVzY3JpcHRpb24sXG4gICAgICB9KTtcblxuICAgICAgaWYgKERhdGUubm93KCkgPj0gZGVhZGxpbmVBdCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FJIHZpZGVvIGdlbmVyYXRpb24gZXhjZWVkZWQgdGhlIG92ZXJhbGwgcHJvZHVjdGlvbiB0aW1lb3V0IGJlZm9yZSBhbGwgc2NlbmVzIGNvdWxkIHN0YXJ0LicpO1xuICAgICAgfVxuICAgICAgaWYgKHNob3VsZENhbmNlbCAmJiBhd2FpdCBzaG91bGRDYW5jZWwoKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FJIHZpZGVvIGdlbmVyYXRpb24gd2FzIGNhbmNlbGxlZCBieSB0aGUgdXNlci4nKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHJhdzogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICBsZXQgbGFzdEVycm9yOiB1bmtub3duID0gbnVsbDtcbiAgICAgIG9uUHJvZ3Jlc3M/LihNYXRoLm1heCg4MSwgODAgKyBNYXRoLnJvdW5kKChjb21wbGV0ZWQgLyBzY2VuZXMubGVuZ3RoKSAqIDE0KSksIGBHZW5lcmF0aW5nIEFJIHNjZW5lICR7c2NlbmVJbmRleCArIDF9IG9mICR7c2NlbmVzLmxlbmd0aH1gKTtcbiAgICAgIGZvciAobGV0IHByb3ZpZGVySW5kZXggPSAwOyBwcm92aWRlckluZGV4IDwgcHJvdmlkZXJPcmRlci5sZW5ndGg7IHByb3ZpZGVySW5kZXgrKykge1xuICAgICAgICBjb25zdCBzY2VuZVByb3ZpZGVyID0gcHJvdmlkZXJPcmRlcltwcm92aWRlckluZGV4XTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBzdGF0dXMgPSAobWVzc2FnZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwY3QgPSBNYXRoLm1heCg4MSwgODAgKyBNYXRoLnJvdW5kKChjb21wbGV0ZWQgLyBzY2VuZXMubGVuZ3RoKSAqIDE0KSk7XG4gICAgICAgICAgICBvblByb2dyZXNzPy4ocGN0LCBgJHttZXNzYWdlfSBcdTAwQjcgJHtjb21wbGV0ZWR9LyR7c2NlbmVzLmxlbmd0aH0gc2NlbmVzIGNvbXBsZXRlYCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICByYXcgPSBzY2VuZVByb3ZpZGVyID09PSAnZ2VtaW5pJ1xuICAgICAgICAgICAgPyBhd2FpdCBnZW5lcmF0ZUdlbWluaVNjZW5lKFxuICAgICAgICAgICAgICAgIGpvYklkLCBzY2VuZUluZGV4LCBwcm9tcHQsIHNjZW5lLCByZWZlcmVuY2VJbWFnZXMsIGluZGljZXMsIGFzcGVjdFJhdGlvLCBvdXRwdXRRdWFsaXR5LCAhc2lsZW50LFxuICAgICAgICAgICAgICAgIHN0YXR1cywgc2hvdWxkQ2FuY2VsLCBkZWFkbGluZUF0LFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICA6IGF3YWl0IGdlbmVyYXRlR3B1VmlkZW8oXG4gICAgICAgICAgICAgICAgam9iSWQsIHNjZW5lSW5kZXgsIHByb21wdCwgaW5kaWNlcy5tYXAoKGluZGV4KSA9PiByZWZlcmVuY2VJbWFnZXNbaW5kZXhdKSwgcHJvdmlkZXJBc3BlY3RSYXRpbyhhc3BlY3RSYXRpbyksXG4gICAgICAgICAgICAgICAgc2hvdWxkQ2FuY2VsLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgIGlmIChzY2VuZVByb3ZpZGVyICE9PSBwcm92aWRlcikgY29uc29sZS53YXJuKGBbYWktdmlkZW9dIGpvYj0ke2pvYklkfSBzY2VuZT0ke3NjZW5lSW5kZXggKyAxfSBmYWxsYmFja19wcm92aWRlcj0ke3NjZW5lUHJvdmlkZXJ9IHN1Y2NlZWRlZGApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGxhc3RFcnJvciA9IGVycm9yO1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKTtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFthaS12aWRlb10gam9iPSR7am9iSWR9IHNjZW5lPSR7c2NlbmVJbmRleCArIDF9IHByb3ZpZGVyPSR7c2NlbmVQcm92aWRlcn0gZmFpbGVkOiAke21lc3NhZ2V9YCk7XG4gICAgICAgICAgaWYgKC9jYW5jZWxsZWQgYnkgdGhlIHVzZXIvaS50ZXN0KG1lc3NhZ2UpKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgICBjb25zdCBuZXh0UHJvdmlkZXIgPSBwcm92aWRlck9yZGVyW3Byb3ZpZGVySW5kZXggKyAxXTtcbiAgICAgICAgICBpZiAobmV4dFByb3ZpZGVyKSB7XG4gICAgICAgICAgICBvblByb2dyZXNzPy4oTWF0aC5tYXgoODEsIDgwICsgTWF0aC5yb3VuZCgoY29tcGxldGVkIC8gc2NlbmVzLmxlbmd0aCkgKiAxNCkpLCBgU2NlbmUgJHtzY2VuZUluZGV4ICsgMX06ICR7c2NlbmVQcm92aWRlciA9PT0gJ2dlbWluaScgPyAnVmVvJyA6ICdvcGVuLXNvdXJjZSB2aWRlbyd9IGZhaWxlZCBcdTIwMTQgdHJ5aW5nICR7bmV4dFByb3ZpZGVyID09PSAnZ2VtaW5pJyA/ICdWZW8nIDogJ29wZW4tc291cmNlIHZpZGVvJ30gZmFsbGJhY2tgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghcmF3KSB0aHJvdyBsYXN0RXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGxhc3RFcnJvciA6IG5ldyBFcnJvcihgQUkgdmlkZW8gc2NlbmUgJHtzY2VuZUluZGV4ICsgMX0gZmFpbGVkIG9uIGFsbCBjb25maWd1cmVkIHByb3ZpZGVycy5gKTtcblxuICAgICAgaWYgKHNob3VsZENhbmNlbCAmJiBhd2FpdCBzaG91bGRDYW5jZWwoKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FJIHZpZGVvIGdlbmVyYXRpb24gd2FzIGNhbmNlbGxlZCBieSB0aGUgdXNlci4nKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBwYXRoLmpvaW4oQVNTRVRTX0RJUiwgam9iSWQsIGBhaS1zY2VuZS0ke3NjZW5lSW5kZXggKyAxfS1ub3JtYWxpemVkLm1wNGApO1xuICAgICAgY29uc3QgbmF0aXZlQXVkaW8gPSBhd2FpdCBub3JtYWxpemVDbGlwKHJhdywgbm9ybWFsaXplZCwgYXNwZWN0UmF0aW8sIG91dHB1dFF1YWxpdHksIGZyYW1lUmF0ZSk7XG4gICAgICBjb21wbGV0ZWQrKztcbiAgICAgIGNvbnN0IHBjdCA9IDgwICsgTWF0aC5yb3VuZCgoY29tcGxldGVkIC8gc2NlbmVzLmxlbmd0aCkgKiAxNCk7XG4gICAgICBjb25zdCBlbGFwc2VkU2Vjb25kcyA9IE1hdGgubWF4KDEsIChEYXRlLm5vdygpIC0gZ2VuZXJhdGlvblN0YXJ0ZWRBdCkgLyAxMDAwKTtcbiAgICAgIGNvbnN0IGF2ZXJhZ2VTY2VuZVNlY29uZHMgPSBlbGFwc2VkU2Vjb25kcyAqIFZJREVPX0NPTkNVUlJFTkNZIC8gTWF0aC5tYXgoMSwgY29tcGxldGVkKTtcbiAgICAgIGNvbnN0IGJhdGNoZXNMZWZ0ID0gTWF0aC5jZWlsKE1hdGgubWF4KDAsIHNjZW5lcy5sZW5ndGggLSBjb21wbGV0ZWQpIC8gVklERU9fQ09OQ1VSUkVOQ1kpO1xuICAgICAgY29uc3QgZXRhU2Vjb25kcyA9IE1hdGgubWF4KDEwLCBNYXRoLnJvdW5kKGF2ZXJhZ2VTY2VuZVNlY29uZHMgKiBiYXRjaGVzTGVmdCArIDM1KSk7XG4gICAgICBvblByb2dyZXNzPy4ocGN0LCBgQUkgc2NlbmUgJHtzY2VuZUluZGV4ICsgMX0gY29tcGxldGUgXHUwMEI3ICR7Y29tcGxldGVkfS8ke3NjZW5lcy5sZW5ndGh9IHNjZW5lcyByZWFkeWAsIGV0YVNlY29uZHMpO1xuICAgICAgcmV0dXJuIHsgZmlsZTogbm9ybWFsaXplZCwgbmF0aXZlQXVkaW8gfTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGZhaWx1cmVzID0gcmVzdWx0c1xuICAgICAgLm1hcCgocmVzdWx0LCBpbmRleCkgPT4gKHsgcmVzdWx0LCBpbmRleCB9KSlcbiAgICAgIC5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIHsgcmVzdWx0OiBQcm9taXNlUmVqZWN0ZWRSZXN1bHQ7IGluZGV4OiBudW1iZXIgfSA9PiBpdGVtLnJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpO1xuICAgIGlmIChmYWlsdXJlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHN1bW1hcnkgPSBmYWlsdXJlcy5zbGljZSgwLCAzKS5tYXAoKHsgcmVzdWx0LCBpbmRleCB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlYXNvbiA9IHJlc3VsdC5yZWFzb24gaW5zdGFuY2VvZiBFcnJvciA/IHJlc3VsdC5yZWFzb24ubWVzc2FnZSA6IFN0cmluZyhyZXN1bHQucmVhc29uKTtcbiAgICAgICAgcmV0dXJuIGBzY2VuZSAke2luZGV4ICsgMX06ICR7cmVhc29ufWA7XG4gICAgICB9KS5qb2luKCcgfCAnKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQUkgdmlkZW8gZ2VuZXJhdGlvbiBkaWQgbm90IGNvbXBsZXRlIGFsbCAke3NjZW5lcy5sZW5ndGh9IHBsYW5uZWQgc2NlbmVzICgke2ZhaWx1cmVzLmxlbmd0aH0gZmFpbGVkKS4gJHtzdW1tYXJ5fWApO1xuICAgIH1cblxuICAgIGNvbnN0IHN1Y2Nlc3NmdWwgPSByZXN1bHRzLmZsYXRNYXAoKHJlc3VsdCkgPT4gcmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgPyBbcmVzdWx0LnZhbHVlXSA6IFtdKTtcbiAgICBpZiAoc3VjY2Vzc2Z1bC5sZW5ndGggIT09IHNjZW5lcy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQUkgdmlkZW8gZ2VuZXJhdGlvbiByZXR1cm5lZCAke3N1Y2Nlc3NmdWwubGVuZ3RofS8ke3NjZW5lcy5sZW5ndGh9IHNjZW5lczsgcmVmdXNpbmcgdG8gZGVsaXZlciBhbiBpbmNvbXBsZXRlIHZpZGVvLmApO1xuICAgIH1cblxuICAgIG9uUHJvZ3Jlc3M/Lig5NSwgJ0FsbCBBSSBzY2VuZXMgYXJlIHJlYWR5IFx1MDBCNyBhc3NlbWJsaW5nIHRoZSBmaW5hbCBtYXN0ZXInLCA0NSk7XG4gICAgY29uc3Qgc3RpdGNoZWQgPSBhd2FpdCBjb25jYXRDbGlwcyhqb2JJZCwgc3VjY2Vzc2Z1bC5tYXAoKGl0ZW0pID0+IGl0ZW0uZmlsZSkpO1xuICAgIG9uUHJvZ3Jlc3M/Lig5NiwgJ0ZpbmlzaGluZyB5b3VyIEFJIHZpZGVvJywgMzApO1xuXG4gICAgbGV0IG5hcnJhdGlvbkVycm9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgbGV0IG5hcnJhdGlvbjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgaWYgKCFzaWxlbnQgJiYgbmFycmF0aW9uQXVkaW9QYXRoKSB7XG4gICAgICB0cnkgeyBuYXJyYXRpb24gPSBhd2FpdCBuYXJyYXRpb25BdWRpb1BhdGg7IH1cbiAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgbmFycmF0aW9uRXJyb3IgPSAoZXJyIGFzIEVycm9yKS5tZXNzYWdlO1xuICAgICAgICBjb25zb2xlLndhcm4oYFthaS12aWRlb10gam9iPSR7am9iSWR9IG5hcnJhdGlvbiB1bmF2YWlsYWJsZTogJHtuYXJyYXRpb25FcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtaXhPdXRwdXQgPSBwYXRoLmpvaW4oQVNTRVRTX0RJUiwgam9iSWQsICdhaS12aWRlby1hdWRpby1taXgubXA0Jyk7XG4gICAgY29uc3QgbmF0aXZlQXVkaW9QcmVzZW50ID0gc3VjY2Vzc2Z1bC5zb21lKChpdGVtKSA9PiBpdGVtLm5hdGl2ZUF1ZGlvKTtcbiAgICBjb25zdCBtdXNpY0JlZCA9IG11c2ljT25seSA/IGF3YWl0IGNyZWF0ZU11c2ljT25seUJlZChqb2JJZCwgYXdhaXQgZHVyYXRpb24oc3RpdGNoZWQpKSA6IG51bGw7XG4gICAgYXdhaXQgZmluaXNoQXVkaW8oc3RpdGNoZWQsIG1peE91dHB1dCwgc2lsZW50LCBtdXNpY0JlZCA/PyBuYXJyYXRpb24sIG11c2ljT25seSA/IGZhbHNlIDogbmF0aXZlQXVkaW9QcmVzZW50KTtcbiAgICBjb25zdCBicmFuZGVkT3V0cHV0ID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkLCBgYWktdmlkZW8tJHttb2RlfS0ke3ZhcmlhbnRTZWVkIHx8IERhdGUubm93KCl9Lm1wNGApO1xuICAgIGxldCBvdXRwdXQgPSBtaXhPdXRwdXQ7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFkZEJyYW5kQ2xvc2luZ092ZXJsYXkobWl4T3V0cHV0LCBicmFuZGVkT3V0cHV0LCBqb2JJZCwgc2l0ZVRpdGxlKTtcbiAgICAgIG91dHB1dCA9IGJyYW5kZWRPdXRwdXQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2FybihgW2FpLXZpZGVvXSBqb2I9JHtqb2JJZH0gYnJhbmRlZCBlbmRpbmcgdW5hdmFpbGFibGU6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuICAgIH1cbiAgICBjb25zdCBzZWNvbmRzID0gYXdhaXQgZHVyYXRpb24ob3V0cHV0KTtcbiAgICBjb25zb2xlLmluZm8oYFthaS12aWRlb10gam9iPSR7am9iSWR9IG91dHB1dD0ke3BhdGguYmFzZW5hbWUob3V0cHV0KX0gZHVyYXRpb249JHtzZWNvbmRzLnRvRml4ZWQoMil9IGNsaXBzPSR7c3VjY2Vzc2Z1bC5sZW5ndGh9IG5hdGl2ZV9hdWRpbz0ke25hdGl2ZUF1ZGlvUHJlc2VudH0gbmFycmF0aW9uPSR7Qm9vbGVhbihuYXJyYXRpb24pfWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHVybDogYC9hcGkvYXNzZXRzLyR7am9iSWR9LyR7cGF0aC5iYXNlbmFtZShvdXRwdXQpfWAsXG4gICAgICBhc3BlY3RSYXRpbyxcbiAgICAgIGNsaXBDb3VudDogc3VjY2Vzc2Z1bC5sZW5ndGgsXG4gICAgICBvdXRwdXRRdWFsaXR5LFxuICAgICAgZnJhbWVSYXRlLFxuICAgICAgbmFycmF0aW9uRXJyb3IsXG4gICAgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBjbGVhbnVwKGpvYklkKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGNocm9taXVtLCB0eXBlIFBhZ2UsIHR5cGUgQnJvd3NlciB9IGZyb20gJ3BsYXl3cmlnaHQnO1xuaW1wb3J0IHsgZXhlY0ZpbGUgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgdmFsaWRhdGVVcmwgfSBmcm9tICcuL3NzcmYuanMnO1xuXG5jb25zdCBleGVjRmlsZUFzeW5jID0gcHJvbWlzaWZ5KGV4ZWNGaWxlKTtcblxuZXhwb3J0IGNvbnN0IEFTU0VUU19ESVIgPSBwcm9jZXNzLmVudi5BU1NFVFNfRElSID8/ICcvdG1wL2Fpd2VidmlkZW8tYXNzZXRzJztcbmNvbnN0IFZJRVdQT1JUID0geyB3aWR0aDogMTQ0MCwgaGVpZ2h0OiA5MDAgfTtcbmNvbnN0IE1PQklMRV9WSUVXUE9SVCA9IHsgd2lkdGg6IDQzMCwgaGVpZ2h0OiA5MzIgfTtcbmNvbnN0IE1BWF9QQUdFUyA9IE1hdGgubWluKDIwLCBNYXRoLm1heCgxLCBOdW1iZXIocHJvY2Vzcy5lbnYuQ0FQVFVSRV9NQVhfUEFHRVMgPz8gOCkpKTtcbmNvbnN0IFNFVFRMRV9NUyA9IE1hdGgubWF4KDMwMCwgTWF0aC5taW4oMzAwMCwgTnVtYmVyKHByb2Nlc3MuZW52LkNBUFRVUkVfU0VUVExFX01TID8/IDkwMCkpKTtcbmNvbnN0IENBUFRVUkVfQ09OQ1VSUkVOQ1kgPSBNYXRoLm1heCgxLCBNYXRoLm1pbigzLCBOdW1iZXIocHJvY2Vzcy5lbnYuQ0FQVFVSRV9DT05DVVJSRU5DWSA/PyAxKSkpO1xuLy8gVGhpcyBpcyBhIHNvZnQgYnVkZ2V0LCBub3QgYSBicm93c2VyLWtpbGxpbmcgdGltZXIuIEEgc2xvdyBvcHRpb25hbCBwYWdlIGlzXG4vLyBza2lwcGVkIHdoZW4gdGhlIGJ1ZGdldCBpcyBuZWFybHkgZXhoYXVzdGVkLCB3aGlsZSBhIHN1Y2Nlc3NmdWwgaG9tZXBhZ2Vcbi8vIGNhcHR1cmUgaXMgc3RpbGwgcmV0dXJuZWQgaW5zdGVhZCBvZiBiZWluZyBkZXN0cm95ZWQgYnkgYSBnbG9iYWwgdGltZW91dC5cbmNvbnN0IENBUFRVUkVfQlVER0VUX01TID0gTWF0aC5tYXgoMTgwXzAwMCwgTnVtYmVyKHByb2Nlc3MuZW52LkNBUFRVUkVfVElNRU9VVF9NUyA/PyA2MDBfMDAwKSk7XG5jb25zdCBDSElMRF9QQUdFX0JVREdFVF9NUyA9IE1hdGgubWF4KDE4XzAwMCwgTWF0aC5taW4oNzVfMDAwLCBOdW1iZXIocHJvY2Vzcy5lbnYuQ0FQVFVSRV9DSElMRF9USU1FT1VUX01TID8/IDQyXzAwMCkpKTtcbmxldCBhY3RpdmVDYXB0dXJlcyA9IDA7XG5jb25zdCBjYXB0dXJlV2FpdGVyczogQXJyYXk8KCkgPT4gdm9pZD4gPSBbXTtcblxuZXhwb3J0IGludGVyZmFjZSBDYXB0dXJlZFBhZ2Uge1xuICB1cmw6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgc2NyZWVuc2hvdFVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNpdGVDYXB0dXJlIHtcbiAgdGl0bGU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZyB8IG51bGw7XG4gIGxvZ29Vcmw6IHN0cmluZyB8IG51bGw7XG4gIGJyYW5kQ29sb3JzOiBzdHJpbmdbXTtcbiAgaHRtbExhbmc6IHN0cmluZyB8IG51bGw7XG4gIHNjcmVlbnNob3RVcmw6IHN0cmluZztcbiAgZnVsbFBhZ2VTY3JlZW5zaG90VXJsOiBzdHJpbmc7XG4gIG1vYmlsZVNjcmVlbnNob3RVcmw6IHN0cmluZyB8IG51bGw7XG4gIG1vYmlsZUZ1bGxQYWdlU2NyZWVuc2hvdFVybDogc3RyaW5nIHwgbnVsbDtcbiAgcmVjb3JkaW5nVXJsOiBzdHJpbmcgfCBudWxsO1xuICBwYWdlczogQ2FwdHVyZWRQYWdlW107XG4gIHBhZ2VDb3VudDogbnVtYmVyO1xufVxuXG5leHBvcnQgdHlwZSBDYXB0dXJlUHJvZ3Jlc3MgPSAocHJvZ3Jlc3M6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nLCBldGFTZWNvbmRzOiBudW1iZXIpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVEaXIoZGlyOiBzdHJpbmcpIHtcbiAgYXdhaXQgZnMubWtkaXIoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYWNxdWlyZUNhcHR1cmVTbG90KCkge1xuICBpZiAoYWN0aXZlQ2FwdHVyZXMgPCBDQVBUVVJFX0NPTkNVUlJFTkNZKSB7XG4gICAgYWN0aXZlQ2FwdHVyZXMrKztcbiAgICByZXR1cm47XG4gIH1cbiAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IGNhcHR1cmVXYWl0ZXJzLnB1c2gocmVzb2x2ZSkpO1xuICBhY3RpdmVDYXB0dXJlcysrO1xufVxuXG5mdW5jdGlvbiByZWxlYXNlQ2FwdHVyZVNsb3QoKSB7XG4gIGFjdGl2ZUNhcHR1cmVzID0gTWF0aC5tYXgoMCwgYWN0aXZlQ2FwdHVyZXMgLSAxKTtcbiAgY2FwdHVyZVdhaXRlcnMuc2hpZnQoKT8uKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGd1YXJkTmF2aWdhdGlvbihyb3V0ZTogaW1wb3J0KCdwbGF5d3JpZ2h0JykuUm91dGUpIHtcbiAgY29uc3QgcmVxdWVzdCA9IHJvdXRlLnJlcXVlc3QoKTtcbiAgaWYgKCFyZXF1ZXN0LmlzTmF2aWdhdGlvblJlcXVlc3QoKSkgcmV0dXJuIHJvdXRlLmNvbnRpbnVlKCk7XG4gIHRyeSB7XG4gICAgYXdhaXQgdmFsaWRhdGVVcmwocmVxdWVzdC51cmwoKSk7XG4gICAgYXdhaXQgcm91dGUuY29udGludWUoKTtcbiAgfSBjYXRjaCB7XG4gICAgYXdhaXQgcm91dGUuYWJvcnQoJ2Jsb2NrZWRieWNsaWVudCcpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlSW1hZ2VGaWxlKGpvYklkOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgZGF0YTogQnVmZmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgZGlyID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkKTtcbiAgYXdhaXQgZW5zdXJlRGlyKGRpcik7XG4gIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4oZGlyLCBuYW1lKSwgZGF0YSk7XG4gIHJldHVybiBgL2FwaS9hc3NldHMvJHtqb2JJZH0vJHtuYW1lfWA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhUaW1lb3V0PFQ+KHByb21pc2U6IFByb21pc2U8VD4sIHRpbWVvdXRNczogbnVtYmVyLCBsYWJlbDogc3RyaW5nKTogUHJvbWlzZTxUPiB7XG4gIGxldCB0aW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbDtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgUHJvbWlzZS5yYWNlKFtcbiAgICAgIHByb21pc2UsXG4gICAgICBuZXcgUHJvbWlzZTxUPigoXywgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QobmV3IEVycm9yKGAke2xhYmVsfV9USU1FT1VUYCkpLCB0aW1lb3V0TXMpO1xuICAgICAgfSksXG4gICAgXSk7XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKHRpbWVyKSBjbGVhclRpbWVvdXQodGltZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyZVBhZ2UocGFnZTogUGFnZSkge1xuICBwYWdlLnNldERlZmF1bHRUaW1lb3V0KDE1XzAwMCk7XG4gIHBhZ2Uuc2V0RGVmYXVsdE5hdmlnYXRpb25UaW1lb3V0KDQwXzAwMCk7XG59XG5cbi8qKlxuICogSHlkcmF0ZSBsYXp5IG1lZGlhIHdpdGhvdXQgbGV0dGluZyBvbmUgcGFnZSBtb25vcG9saXplIHRoZSB3aG9sZSBjYXB0dXJlLlxuICogVGhlIGhvbWVwYWdlIGdldHMgYSBkZWVwZXIgcGFzczsgY2hpbGQgcGFnZXMgZ2V0IGEgcXVpY2tlciBzaW5nbGUgcGFzcy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gd2FpdEZvclJlYWR5KHBhZ2U6IFBhZ2UsIGRlZXAgPSBmYWxzZSkge1xuICBhd2FpdCBwYWdlLndhaXRGb3JMb2FkU3RhdGUoJ2RvbWNvbnRlbnRsb2FkZWQnLCB7IHRpbWVvdXQ6IDQwXzAwMCB9KTtcbiAgYXdhaXQgcGFnZS53YWl0Rm9yTG9hZFN0YXRlKCduZXR3b3JraWRsZScsIHsgdGltZW91dDogZGVlcCA/IDEwXzAwMCA6IDVfMDAwIH0pLmNhdGNoKCgpID0+IHt9KTtcblxuICBhd2FpdCB3aXRoVGltZW91dChwYWdlLmV2YWx1YXRlKGFzeW5jICh7IHBhc3NlcywgbWF4U3RlcHMsIHN0ZXBEZWxheSB9KSA9PiB7XG4gICAgY29uc3Qgc2xlZXAgPSAobXM6IG51bWJlcikgPT4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICBjb25zdCBoeWRyYXRlID0gKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBpbWcgb2YgQXJyYXkuZnJvbShkb2N1bWVudC5pbWFnZXMpLnNsaWNlKDAsIDUwMCkpIHtcbiAgICAgICAgaW1nLmxvYWRpbmcgPSAnZWFnZXInO1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBpbWcuZGF0YXNldC5zcmMgfHwgaW1nLmRhdGFzZXQubGF6eVNyYyB8fCBpbWcuZGF0YXNldC5vcmlnaW5hbCB8fCBpbWcuZ2V0QXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsLXNyYycpIHx8IGltZy5nZXRBdHRyaWJ1dGUoJ2RhdGEtbGF6eScpIHx8IGltZy5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG4gICAgICAgIGNvbnN0IHNvdXJjZVNldCA9IGltZy5kYXRhc2V0LnNyY3NldCB8fCBpbWcuZ2V0QXR0cmlidXRlKCdkYXRhLXNyY3NldCcpO1xuICAgICAgICBpZiAoc291cmNlICYmIGltZy5zcmMgIT09IHNvdXJjZSkgaW1nLnNyYyA9IHNvdXJjZTtcbiAgICAgICAgaWYgKHNvdXJjZVNldCAmJiBpbWcuc3Jjc2V0ICE9PSBzb3VyY2VTZXQpIGltZy5zcmNzZXQgPSBzb3VyY2VTZXQ7XG4gICAgICAgIGltZy5kZWNvZGU/LigpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgncGljdHVyZSBzb3VyY2UsIHZpZGVvIHNvdXJjZScpKSkge1xuICAgICAgICBjb25zdCBsYXp5U3JjID0gc291cmNlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcbiAgICAgICAgY29uc3QgbGF6eVNldCA9IHNvdXJjZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Jjc2V0Jyk7XG4gICAgICAgIGlmIChsYXp5U3JjKSBzb3VyY2Uuc2V0QXR0cmlidXRlKCdzcmMnLCBsYXp5U3JjKTtcbiAgICAgICAgaWYgKGxhenlTZXQpIHNvdXJjZS5zZXRBdHRyaWJ1dGUoJ3NyY3NldCcsIGxhenlTZXQpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oJ1tkYXRhLWJnXSwgW2RhdGEtYmFja2dyb3VuZC1pbWFnZV0sIFtkYXRhLWxhenktYmFja2dyb3VuZF0nKSkuc2xpY2UoMCwgMjUwKSkge1xuICAgICAgICBjb25zdCBiYWNrZ3JvdW5kID0gZWxlbWVudC5kYXRhc2V0LmJnIHx8IGVsZW1lbnQuZGF0YXNldC5iYWNrZ3JvdW5kSW1hZ2UgfHwgZWxlbWVudC5kYXRhc2V0LmxhenlCYWNrZ3JvdW5kO1xuICAgICAgICBpZiAoYmFja2dyb3VuZCkgZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBiYWNrZ3JvdW5kLnN0YXJ0c1dpdGgoJ3VybCgnKSA/IGJhY2tncm91bmQgOiBgdXJsKFwiJHtiYWNrZ3JvdW5kfVwiKWA7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHZpZGVvIG9mIEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndmlkZW8nKSkuc2xpY2UoMCwgMzApKSB7XG4gICAgICAgIHZpZGVvLnByZWxvYWQgPSAnbWV0YWRhdGEnO1xuICAgICAgICB2aWRlby5tdXRlZCA9IHRydWU7XG4gICAgICAgIHZpZGVvLmxvYWQoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaHlkcmF0ZSgpO1xuICAgIGZvciAobGV0IHBhc3MgPSAwOyBwYXNzIDwgcGFzc2VzOyBwYXNzKyspIHtcbiAgICAgIGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KGRvY3VtZW50LmJvZHkuc2Nyb2xsSGVpZ2h0LCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsSGVpZ2h0KTtcbiAgICAgIGNvbnN0IG1heFkgPSBNYXRoLm1heCgwLCBoZWlnaHQgLSBpbm5lckhlaWdodCk7XG4gICAgICBjb25zdCBzdGVwQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLm1pbihtYXhTdGVwcywgTWF0aC5jZWlsKG1heFkgLyBNYXRoLm1heCg1MDAsIGlubmVySGVpZ2h0ICogMC44NSkpKSk7XG4gICAgICBmb3IgKGxldCBzdGVwID0gMDsgc3RlcCA8PSBzdGVwQ291bnQ7IHN0ZXArKykge1xuICAgICAgICBjb25zdCB5ID0gc3RlcENvdW50ID09PSAwID8gMCA6IE1hdGgucm91bmQoKG1heFkgKiBzdGVwKSAvIHN0ZXBDb3VudCk7XG4gICAgICAgIHdpbmRvdy5zY3JvbGxUbygwLCB5KTtcbiAgICAgICAgaHlkcmF0ZSgpO1xuICAgICAgICBhd2FpdCBzbGVlcChzdGVwRGVsYXkpO1xuICAgICAgfVxuICAgIH1cbiAgICB3aW5kb3cuc2Nyb2xsVG8oMCwgMCk7XG4gICAgaHlkcmF0ZSgpO1xuICAgIGF3YWl0IHNsZWVwKDM1MCk7XG4gIH0sIHsgcGFzc2VzOiBkZWVwID8gMiA6IDEsIG1heFN0ZXBzOiBkZWVwID8gMTYgOiAxMCwgc3RlcERlbGF5OiBkZWVwID8gMTQwIDogMTAwIH0pLCBkZWVwID8gMTRfMDAwIDogN18wMDAsICdIWURSQVRFJykuY2F0Y2goKCkgPT4ge30pO1xuXG4gIGF3YWl0IHBhZ2Uud2FpdEZvckxvYWRTdGF0ZSgnbmV0d29ya2lkbGUnLCB7IHRpbWVvdXQ6IGRlZXAgPyA3XzAwMCA6IDNfMDAwIH0pLmNhdGNoKCgpID0+IHt9KTtcbiAgYXdhaXQgd2l0aFRpbWVvdXQocGFnZS5ldmFsdWF0ZShhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgZm9udHMgPSAoZG9jdW1lbnQgYXMgRG9jdW1lbnQgJiB7IGZvbnRzPzogRm9udEZhY2VTZXQgfSkuZm9udHM7XG4gICAgaWYgKGZvbnRzKSBhd2FpdCBmb250cy5yZWFkeS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgY29uc3QgaW1hZ2VzID0gQXJyYXkuZnJvbShkb2N1bWVudC5pbWFnZXMpLnNsaWNlKDAsIDI1MCk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoaW1hZ2VzLm1hcCgoaW1nKSA9PiBpbWcuY29tcGxldGUgPyBQcm9taXNlLnJlc29sdmUoKSA6IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICBjb25zdCBkb25lID0gKCkgPT4gcmVzb2x2ZSgpO1xuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBkb25lLCB7IG9uY2U6IHRydWUgfSk7XG4gICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBkb25lLCB7IG9uY2U6IHRydWUgfSk7XG4gICAgICBzZXRUaW1lb3V0KGRvbmUsIDI1MDApO1xuICAgIH0pKSk7XG4gIH0pLCBkZWVwID8gN18wMDAgOiA0XzAwMCwgJ01FRElBJykuY2F0Y2goKCkgPT4ge30pO1xuICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KFNFVFRMRV9NUyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RNZXRhZGF0YShwYWdlOiBQYWdlLCBmYWxsYmFja1VybDogc3RyaW5nKSB7XG4gIHJldHVybiBwYWdlLmV2YWx1YXRlKCh1cmwpID0+IHtcbiAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LnRpdGxlLnRyaW0oKSB8fCBuZXcgVVJMKHVybCkuaG9zdG5hbWU7XG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxNZXRhRWxlbWVudD4oJ21ldGFbbmFtZT1cImRlc2NyaXB0aW9uXCJdJyk/LmNvbnRlbnQ/LnRyaW0oKSB8fCBudWxsO1xuICAgIGNvbnN0IGljb24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxMaW5rRWxlbWVudD4oJ2xpbmtbcmVsKj1cImljb25cIl0nKT8uaHJlZiB8fCBudWxsO1xuICAgIGNvbnN0IGxvZ28gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxJbWFnZUVsZW1lbnQ+KCdoZWFkZXIgaW1nLCBuYXYgaW1nLCBpbWdbYWx0Kj1cImxvZ29cIiBpXScpPy5zcmMgfHwgaWNvbjtcbiAgICBjb25zdCBodG1sTGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nPy50cmltKCkgfHwgbnVsbDtcbiAgICBjb25zdCBjb2xvcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBhZGQgPSAodmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvI1swLTlhLWZdezZ9XFxiL2lnKTtcbiAgICAgIG1hdGNoPy5mb3JFYWNoKChjb2xvcikgPT4gY29sb3JzLnNpemUgPCA2ICYmIGNvbG9ycy5hZGQoY29sb3IudG9Mb3dlckNhc2UoKSkpO1xuICAgIH07XG4gICAgYWRkKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5pbm5lckhUTUwuc2xpY2UoMCwgNTAwXzAwMCkpO1xuICAgIHJldHVybiB7IHRpdGxlLCBkZXNjcmlwdGlvbiwgaWNvblVybDogaWNvbiwgbG9nb1VybDogbG9nbywgYnJhbmRDb2xvcnM6IEFycmF5LmZyb20oY29sb3JzKSwgaHRtbExhbmcgfTtcbiAgfSwgZmFsbGJhY2tVcmwpO1xufVxuXG4vKipcbiAqIFByZXNlcnZlIGEgY2xlYW4gbG9jYWwgY29weSBvZiB0aGUgc2l0ZSdzIG93biBpY29uL2xvZ28uIFRoZSBzb3VyY2UgVVJMIGlzXG4gKiB2YWxpZGF0ZWQgYmVmb3JlIGl0IGlzIGxvYWRlZCBpbnRvIGEgdGVtcG9yYXJ5IHNxdWFyZSBjYXJkLCBhbmQgUGxheXdyaWdodFxuICogcmFzdGVyaXplcyBTVkcvSUNPL1BORyBpbnB1dHMgdG8gb25lIGRlcGVuZGFibGUgSlBFRyByZWZlcmVuY2UgZm9yIGxhdGVyXG4gKiBpY29uIGdlbmVyYXRpb24gYW5kIGJyYW5kZWQgdmlkZW8gZW5kaW5ncy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY2FwdHVyZVdlYnNpdGVJY29uKHBhZ2U6IFBhZ2UsIGpvYklkOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nIHwgbnVsbCwgZmFsbGJhY2tOYW1lOiBzdHJpbmcsIGJyYW5kQ29sb3I/OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgcmVuZGVyQ2FyZCA9IGFzeW5jIChzcmM6IHN0cmluZyB8IG51bGwpID0+IHtcbiAgICBhd2FpdCBwYWdlLmV2YWx1YXRlKCh7IHNvdXJjZSwgbmFtZSwgY29sb3IgfSkgPT4ge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtYWl3ZWJ2aWRlby1icmFuZC1pY29uXScpPy5yZW1vdmUoKTtcbiAgICAgIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGNhcmQuZGF0YXNldC5haXdlYnZpZGVvQnJhbmRJY29uID0gJ3RydWUnO1xuICAgICAgY2FyZC5zdHlsZS5jc3NUZXh0ID0gYHBvc2l0aW9uOmZpeGVkO2xlZnQ6MTZweDt0b3A6MTZweDt3aWR0aDo1MTJweDtoZWlnaHQ6NTEycHg7ei1pbmRleDoyMTQ3NDgzNjQ3O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLXJhZGl1czo5NnB4O292ZXJmbG93OmhpZGRlbjtib3gtc2hhZG93OjAgMzBweCA4MHB4IHJnYmEoMjAsMTUsMzksLjE4KTtjb2xvcjokey9eI1swLTlhLWZdezZ9JC9pLnRlc3QoY29sb3IgfHwgJycpID8gY29sb3IgOiAnIzZkNGFmZid9YDtcbiAgICAgIGlmIChzb3VyY2UpIHtcbiAgICAgICAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgaW1hZ2UuYWx0ID0gJyc7XG4gICAgICAgIGltYWdlLnNyYyA9IHNvdXJjZTtcbiAgICAgICAgaW1hZ2Uuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmJsb2NrO21heC13aWR0aDo3MCU7bWF4LWhlaWdodDo3MCU7b2JqZWN0LWZpdDpjb250YWluJztcbiAgICAgICAgY2FyZC5hcHBlbmRDaGlsZChpbWFnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBtb25vZ3JhbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgbW9ub2dyYW0udGV4dENvbnRlbnQgPSAobmFtZS50cmltKClbMF0gfHwgJ1cnKS50b0xvY2FsZVVwcGVyQ2FzZSgpO1xuICAgICAgICBtb25vZ3JhbS5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQ6NzAwIDI1MHB4LzEgQXJpYWwsc2Fucy1zZXJpZjtsZXR0ZXItc3BhY2luZzotLjA4ZW07dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLS4wNGVtKSc7XG4gICAgICAgIGNhcmQuYXBwZW5kQ2hpbGQobW9ub2dyYW0pO1xuICAgICAgfVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjYXJkKTtcbiAgICB9LCB7IHNvdXJjZTogc3JjLCBuYW1lOiBmYWxsYmFja05hbWUsIGNvbG9yOiBicmFuZENvbG9yIH0pO1xuICAgIGNvbnN0IGNhcmQgPSBwYWdlLmxvY2F0b3IoJ1tkYXRhLWFpd2VidmlkZW8tYnJhbmQtaWNvbl0nKTtcbiAgICBpZiAoc3JjKSB7XG4gICAgICBhd2FpdCBjYXJkLmxvY2F0b3IoJ2ltZycpLndhaXRGb3IoeyBzdGF0ZTogJ3Zpc2libGUnLCB0aW1lb3V0OiA2XzAwMCB9KTtcbiAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvckZ1bmN0aW9uKCgpID0+IHtcbiAgICAgICAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxJbWFnZUVsZW1lbnQ+KCdbZGF0YS1haXdlYnZpZGVvLWJyYW5kLWljb25dIGltZycpO1xuICAgICAgICByZXR1cm4gQm9vbGVhbihpbWFnZT8uY29tcGxldGUgJiYgaW1hZ2UubmF0dXJhbFdpZHRoID49IDggJiYgaW1hZ2UubmF0dXJhbEhlaWdodCA+PSA4KTtcbiAgICAgIH0sIHVuZGVmaW5lZCwgeyB0aW1lb3V0OiA2XzAwMCB9KTtcbiAgICB9XG4gICAgY29uc3QgYnVmZmVyID0gYXdhaXQgY2FyZC5zY3JlZW5zaG90KHsgdHlwZTogJ2pwZWcnLCBxdWFsaXR5OiA5NiB9KTtcbiAgICBhd2FpdCBjYXJkLmV2YWx1YXRlKChlbGVtZW50KSA9PiBlbGVtZW50LnJlbW92ZSgpKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgcmV0dXJuIGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICd3ZWJzaXRlLWljb24uanBnJywgYnVmZmVyKTtcbiAgfTtcbiAgdHJ5IHtcbiAgICBpZiAoc291cmNlVXJsKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB2YWxpZGF0ZVVybChzb3VyY2VVcmwpO1xuICAgICAgICByZXR1cm4gYXdhaXQgcmVuZGVyQ2FyZChzb3VyY2VVcmwpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbY2FwdHVyZV0gb3JpZ2luYWwgd2Vic2l0ZSBpY29uIHVuYXZhaWxhYmxlLCBjcmVhdGluZyBhIGJyYW5kIG1vbm9ncmFtIGZhbGxiYWNrOiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGF3YWl0IHJlbmRlckNhcmQobnVsbCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgYXdhaXQgcGFnZS5sb2NhdG9yKCdbZGF0YS1haXdlYnZpZGVvLWJyYW5kLWljb25dJykuZXZhbHVhdGVBbGwoKGVsZW1lbnRzKSA9PiBlbGVtZW50cy5mb3JFYWNoKChlbGVtZW50KSA9PiBlbGVtZW50LnJlbW92ZSgpKSkuY2F0Y2goKCkgPT4ge30pO1xuICAgIGNvbnNvbGUud2FybihgW2NhcHR1cmVdIHdlYnNpdGUgaWNvbiBza2lwcGVkOiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYWdlUHJpb3JpdHkodXJsOiBVUkwpIHtcbiAgY29uc3QgcGF0aE5hbWUgPSB1cmwucGF0aG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgcG9zaXRpdmUgPSBbJ3Byb2R1Y3QnLCAnc2hvcCcsICdzdG9yZScsICdjYXRhbG9nJywgJ2NvbGxlY3Rpb24nLCAnY2F0ZWdvcnknLCAnZHJlc3MnLCAnY2xvdGhlcycsICdzaG9lJywgJ3NhbGUnLCAncHJpY2luZycsICdwbGFuJywgJ2ZlYXR1cmUnLCAnc29sdXRpb24nLCAnc2VydmljZScsICdib29raW5nJywgJ3Jlc2VydmUnLCAnZGFzaGJvYXJkJywgJ2RlbW8nLCAnYWJvdXQnLCAnbG9jYXRpb24nXTtcbiAgY29uc3QgbmVnYXRpdmUgPSBbJ3ByaXZhY3knLCAndGVybXMnLCAncG9saWN5JywgJ2xvZ2luJywgJ3JlZ2lzdGVyJywgJ2FjY291bnQnLCAnbG9nb3V0JywgJ3NlYXJjaCcsICd0YWcnLCAnYXV0aG9yJ107XG4gIGxldCBzY29yZSA9IDA7XG4gIGZvciAoY29uc3QgdG9rZW4gb2YgcG9zaXRpdmUpIGlmIChwYXRoTmFtZS5pbmNsdWRlcyh0b2tlbikpIHNjb3JlICs9IDEwO1xuICBmb3IgKGNvbnN0IHRva2VuIG9mIG5lZ2F0aXZlKSBpZiAocGF0aE5hbWUuaW5jbHVkZXModG9rZW4pKSBzY29yZSAtPSAyMDtcbiAgc2NvcmUgLT0gTWF0aC5taW4oMTAsIHBhdGhOYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pLmxlbmd0aCk7XG4gIHJldHVybiBzY29yZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGlzY292ZXJJbnRlcm5hbFBhZ2VzKHBhZ2U6IFBhZ2UsIHNvdXJjZVVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCBvcmlnaW4gPSBuZXcgVVJMKHNvdXJjZVVybCkub3JpZ2luO1xuICBjb25zdCBocmVmcyA9IGF3YWl0IHBhZ2UubG9jYXRvcignYVtocmVmXScpLmV2YWx1YXRlQWxsKChhbmNob3JzKSA9PiBhbmNob3JzLm1hcCgoYSkgPT4gKGEgYXMgSFRNTEFuY2hvckVsZW1lbnQpLmhyZWYpKTtcbiAgY29uc3Qgcm9vdCA9IG5ldyBVUkwoc291cmNlVXJsKTtcbiAgcm9vdC5oYXNoID0gJyc7XG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBmb3IgKGNvbnN0IGhyZWYgb2YgaHJlZnMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChocmVmKTtcbiAgICAgIHVybC5oYXNoID0gJyc7XG4gICAgICBpZiAodXJsLm9yaWdpbiAhPT0gb3JpZ2luIHx8ICFbJ2h0dHA6JywgJ2h0dHBzOiddLmluY2x1ZGVzKHVybC5wcm90b2NvbCkpIGNvbnRpbnVlO1xuICAgICAgaWYgKC9cXC4ocGRmfHppcHxqcGU/Z3xwbmd8Z2lmfHdlYnB8c3ZnfG1wNHx3ZWJtKSQvaS50ZXN0KHVybC5wYXRobmFtZSkpIGNvbnRpbnVlO1xuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IHVybC50b1N0cmluZygpO1xuICAgICAgaWYgKG5vcm1hbGl6ZWQgPT09IHJvb3QudG9TdHJpbmcoKSkgY29udGludWU7XG4gICAgICBjYW5kaWRhdGVzLnNldChub3JtYWxpemVkLCBNYXRoLm1heChjYW5kaWRhdGVzLmdldChub3JtYWxpemVkKSA/PyAtOTk5LCBwYWdlUHJpb3JpdHkodXJsKSkpO1xuICAgIH0gY2F0Y2ggeyAvKiBtYWxmb3JtZWQgbGluayAqLyB9XG4gIH1cbiAgY29uc3Qgc29ydGVkID0gWy4uLmNhbmRpZGF0ZXMuZW50cmllcygpXS5zb3J0KChhLCBiKSA9PiBiWzFdIC0gYVsxXSkubWFwKChbdXJsXSkgPT4gdXJsKTtcbiAgcmV0dXJuIFtyb290LnRvU3RyaW5nKCksIC4uLnNvcnRlZC5zbGljZSgwLCBNYXRoLm1heCgwLCBNQVhfUEFHRVMgLSAxKSldO1xufVxuXG4vKiogUmVjb3JkIG9ubHkgYSBjb25jaXNlLCBpbnRlbnRpb25hbCB0b3VyLiBSZXR1cm5zIHRoZSBhcHByb3hpbWF0ZSByZWNvcmRlZCB0b3VyIGxlbmd0aC4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlY29yZFNtb290aFNjcm9sbChwYWdlOiBQYWdlKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgY29uc3Qgc3RhcnRlZCA9IERhdGUubm93KCk7XG4gIGF3YWl0IHdpdGhUaW1lb3V0KHBhZ2UuZXZhbHVhdGUoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNsZWVwID0gKG1zOiBudW1iZXIpID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgY29uc3QgbWF4WSA9IE1hdGgubWF4KDAsIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxIZWlnaHQgLSBpbm5lckhlaWdodCk7XG4gICAgY29uc3Qgc3RlcHMgPSBNYXRoLm1heCgxLCBNYXRoLm1pbigxOCwgTWF0aC5jZWlsKG1heFkgLyBNYXRoLm1heCg2MDAsIGlubmVySGVpZ2h0ICogMC44NSkpKSk7XG4gICAgd2luZG93LnNjcm9sbFRvKDAsIDApO1xuICAgIGF3YWl0IHNsZWVwKDM1MCk7XG4gICAgZm9yIChsZXQgaW5kZXggPSAxOyBpbmRleCA8PSBzdGVwczsgaW5kZXgrKykge1xuICAgICAgd2luZG93LnNjcm9sbFRvKHsgdG9wOiBNYXRoLnJvdW5kKChtYXhZICogaW5kZXgpIC8gc3RlcHMpLCBiZWhhdmlvcjogJ3Ntb290aCcgfSk7XG4gICAgICBhd2FpdCBzbGVlcCg0MzApO1xuICAgIH1cbiAgICBhd2FpdCBzbGVlcCg1MDApO1xuICAgIHdpbmRvdy5zY3JvbGxUbyh7IHRvcDogMCwgYmVoYXZpb3I6ICdzbW9vdGgnIH0pO1xuICAgIGF3YWl0IHNsZWVwKDg1MCk7XG4gIH0pLCAxOF8wMDAsICdTQ1JPTExfUkVDT1JESU5HJyk7XG4gIHJldHVybiBNYXRoLm1heCgxLCAoRGF0ZS5ub3coKSAtIHN0YXJ0ZWQpIC8gMTAwMCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbnZlcnRSZWNvcmRpbmcoaW5wdXQ6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcsIHN0YXJ0U2Vjb25kcyA9IDAsIGR1cmF0aW9uU2Vjb25kcz86IG51bWJlcikge1xuICBsZXQgc291cmNlRHVyYXRpb24gPSAwO1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZnByb2JlJywgWyctdicsICdlcnJvcicsICctc2hvd19lbnRyaWVzJywgJ2Zvcm1hdD1kdXJhdGlvbicsICctb2YnLCAnZGVmYXVsdD1udz0xOm5rPTEnLCBpbnB1dF0pO1xuICAgIHNvdXJjZUR1cmF0aW9uID0gTnVtYmVyKHN0ZG91dC50cmltKCkpIHx8IDA7XG4gIH0gY2F0Y2ggeyAvKiBmZm1wZWcgYmVsb3cgd2lsbCBwcm92aWRlIHRoZSByZWFsIGVycm9yIGlmIHRoZSBmaWxlIGlzIGludmFsaWQgKi8gfVxuICBjb25zdCBzYWZlU3RhcnQgPSBzb3VyY2VEdXJhdGlvbiA+IDEgPyBNYXRoLm1pbihNYXRoLm1heCgwLCBzdGFydFNlY29uZHMgLSAwLjE1KSwgTWF0aC5tYXgoMCwgc291cmNlRHVyYXRpb24gLSAxKSkgOiBNYXRoLm1heCgwLCBzdGFydFNlY29uZHMgLSAwLjE1KTtcbiAgY29uc3QgcmVtYWluaW5nID0gc291cmNlRHVyYXRpb24gPiAwID8gTWF0aC5tYXgoMC44LCBzb3VyY2VEdXJhdGlvbiAtIHNhZmVTdGFydCkgOiAyMjtcbiAgY29uc3Qgc2FmZUR1cmF0aW9uID0gZHVyYXRpb25TZWNvbmRzICYmIGR1cmF0aW9uU2Vjb25kcyA+IDAgPyBNYXRoLm1pbigyMiwgZHVyYXRpb25TZWNvbmRzICsgMC41LCByZW1haW5pbmcpIDogTWF0aC5taW4oMjIsIHJlbWFpbmluZyk7XG4gIGF3YWl0IGV4ZWNGaWxlQXN5bmMoJ2ZmbXBlZycsIFtcbiAgICAnLXknLFxuICAgIC4uLihzYWZlU3RhcnQgPiAwLjE1ID8gWyctc3MnLCBzYWZlU3RhcnQudG9GaXhlZCgzKV0gOiBbXSksXG4gICAgJy1pJywgaW5wdXQsXG4gICAgLi4uKHNhZmVEdXJhdGlvbiA+IDAgPyBbJy10Jywgc2FmZUR1cmF0aW9uLnRvRml4ZWQoMyldIDogW10pLFxuICAgICctdmYnLCAnc2NhbGU9MTkyMDoxMDgwOmZvcmNlX29yaWdpbmFsX2FzcGVjdF9yYXRpbz1kZWNyZWFzZTpmbGFncz1sYW5jem9zLHBhZD0xOTIwOjEwODA6KG93LWl3KS8yOihvaC1paCkvMjpjb2xvcj1ibGFjaycsXG4gICAgJy1yJywgJzMwJywgJy1jOnYnLCAnbGlieDI2NCcsICctcHJlc2V0JywgJ21lZGl1bScsICctY3JmJywgJzE4JywgJy1waXhfZm10JywgJ3l1djQyMHAnLFxuICAgICctbW92ZmxhZ3MnLCAnK2Zhc3RzdGFydCcsICctYW4nLCBvdXRwdXQsXG4gIF0sIHsgdGltZW91dDogNSAqIDYwXzAwMCwgbWF4QnVmZmVyOiAxNiAqIDEwMjQgKiAxMDI0IH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzY3JlZW5zaG90UGFnZShwYWdlOiBQYWdlLCBmdWxsUGFnZSA9IHRydWUpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcGFnZS5zY3JlZW5zaG90KHsgdHlwZTogJ2pwZWcnLCBxdWFsaXR5OiBmdWxsUGFnZSA/IDkwIDogOTQsIGZ1bGxQYWdlLCB0aW1lb3V0OiBmdWxsUGFnZSA/IDI1XzAwMCA6IDE1XzAwMCB9KTtcbiAgfSBjYXRjaCAoZmlyc3RFcnJvcikge1xuICAgIC8vIEEgaHVnZS9pbmZpbml0ZSBwYWdlIGNhbiBtYWtlIGZ1bGwtcGFnZSBjYXB0dXJlIGV4cGVuc2l2ZS4gS2VlcCB0aGUgcmVhbFxuICAgIC8vIHZpc2libGUgcGFnZSByYXRoZXIgdGhhbiBmYWlsaW5nIHRoZSB3aG9sZSBwcm9qZWN0LlxuICAgIGlmICghZnVsbFBhZ2UpIHRocm93IGZpcnN0RXJyb3I7XG4gICAgY29uc29sZS53YXJuKGBbY2FwdHVyZV0gZmFsbGJhY2sgdmlld3BvcnQgJHtwYWdlLnVybCgpfTogJHsoZmlyc3RFcnJvciBhcyBFcnJvcikubWVzc2FnZX1gKTtcbiAgICByZXR1cm4gcGFnZS5zY3JlZW5zaG90KHsgdHlwZTogJ2pwZWcnLCBxdWFsaXR5OiA5MiwgdGltZW91dDogMTVfMDAwIH0pO1xuICB9XG59XG5cbi8vIEJpbGluZ3VhbCAoRW5nbGlzaC9BcmFiaWMpIHRleHQgaGV1cmlzdGljcyBcdTIwMTQgcmVhbCBlLWNvbW1lcmNlIGFuZCBzdXBwb3J0IFVJXG4vLyBjb3B5IHZhcmllcyBhIGxvdCwgc28gc2V2ZXJhbCBjYW5kaWRhdGUgc3RyaW5ncyBhcmUgdHJpZWQgaW4gb3JkZXIgYW5kIHRoZVxuLy8gZmlyc3QgdmlzaWJsZSBtYXRjaCB3aW5zLiBOb3RoaW5nIGhlcmUgaXMgZXZlciBzaG93biB0byB0aGUgZW5kIHVzZXI7IGl0XG4vLyBvbmx5IGRlY2lkZXMgd2hlcmUgdGhlIGNhcHR1cmUgYnJvd3NlciBjbGlja3MuXG5jb25zdCBBRERfVE9fQ0FSVF9URVhUUyA9IFsnYWRkIHRvIGNhcnQnLCAnYWRkIHRvIGJhZycsICdhZGQgdG8gYmFza2V0JywgJ2J1eSBub3cnLCAnXHUwNjIzXHUwNjM2XHUwNjQxIFx1MDYyNVx1MDY0NFx1MDY0OSBcdTA2MjdcdTA2NDRcdTA2MzNcdTA2NDRcdTA2MjknLCAnXHUwNjIzXHUwNjM2XHUwNjQxIFx1MDYyN1x1MDY0NFx1MDY0OSBcdTA2MjdcdTA2NDRcdTA2MzNcdTA2NDRcdTA2MjknLCAnXHUwNjI1XHUwNjM2XHUwNjI3XHUwNjQxXHUwNjI5IFx1MDY0NFx1MDY0NFx1MDYzM1x1MDY0NFx1MDYyOScsICdcdTA2MjdcdTA2MzZcdTA2MjdcdTA2NDFcdTA2MjkgXHUwNjQ0XHUwNjQ0XHUwNjMzXHUwNjQ0XHUwNjI5JywgJ1x1MDYyN1x1MDYzNFx1MDYyQVx1MDYzMVx1MDY0QSBcdTA2MjdcdTA2NDRcdTA2MjJcdTA2NDYnLCAnXHUwNjI3XHUwNjM0XHUwNjJBXHUwNjMxIFx1MDYyN1x1MDY0NFx1MDYyMlx1MDY0NiddO1xuY29uc3QgQ0FSVF9URVhUUyA9IFsndmlldyBjYXJ0JywgJ215IGNhcnQnLCAnXHUwNjMzXHUwNjQ0XHUwNjI5IFx1MDYyN1x1MDY0NFx1MDYyQVx1MDYzM1x1MDY0OFx1MDY0MicsICdcdTA2MzNcdTA2NDRcdTA2MkFcdTA2NEEnLCAnXHUwNjM5XHUwNjMxXHUwNjM2IFx1MDYyN1x1MDY0NFx1MDYzM1x1MDY0NFx1MDYyOScsICdcdTA2MjdcdTA2NDRcdTA2MzNcdTA2NDRcdTA2MjknXTtcbmNvbnN0IENBUlRfU0VMRUNUT1JTID0gWydhW2hyZWYqPVwiL2NhcnRcIiBpXScsICdhW2hyZWYqPVwiL2Jhc2tldFwiIGldJywgJ2J1dHRvblthcmlhLWxhYmVsKj1cImNhcnRcIiBpXScsICdbcm9sZT1cImJ1dHRvblwiXVthcmlhLWxhYmVsKj1cImNhcnRcIiBpXScsICdbY2xhc3MqPVwiY2FydFwiIGldIGEnXTtcbmNvbnN0IENIRUNLT1VUX1RFWFRTID0gWydjaGVja291dCcsICdwcm9jZWVkIHRvIGNoZWNrb3V0JywgJ3NlY3VyZSBjaGVja291dCcsICdcdTA2MjdcdTA2NDRcdTA2MkZcdTA2NDFcdTA2MzknLCAnXHUwNjI1XHUwNjJBXHUwNjQ1XHUwNjI3XHUwNjQ1IFx1MDYyN1x1MDY0NFx1MDYzN1x1MDY0NFx1MDYyOCcsICdcdTA2MjdcdTA2MkFcdTA2NDVcdTA2MjdcdTA2NDUgXHUwNjI3XHUwNjQ0XHUwNjM3XHUwNjQ0XHUwNjI4JywgJ1x1MDYyNVx1MDY0M1x1MDY0NVx1MDYyN1x1MDY0NCBcdTA2MjdcdTA2NDRcdTA2MzdcdTA2NDRcdTA2MjgnLCAnXHUwNjI3XHUwNjQzXHUwNjQ1XHUwNjI3XHUwNjQ0IFx1MDYyN1x1MDY0NFx1MDYzN1x1MDY0NFx1MDYyOCddO1xuY29uc3QgQ0hFQ0tPVVRfU0VMRUNUT1JTID0gWydhW2hyZWYqPVwiY2hlY2tvdXRcIiBpXScsICdidXR0b25bbmFtZSo9XCJjaGVja291dFwiIGldJywgJ2J1dHRvbltpZCo9XCJjaGVja291dFwiIGldJywgJ1tyb2xlPVwiYnV0dG9uXCJdW2FyaWEtbGFiZWwqPVwiY2hlY2tvdXRcIiBpXSddO1xuY29uc3QgQ09OVkVSU0lPTl9URVhUUyA9IFsnZ2V0IHN0YXJ0ZWQnLCAnc3RhcnQgbm93JywgJ3N0YXJ0IGZyZWUnLCAnc2lnbiB1cCcsICdjcmVhdGUgYWNjb3VudCcsICdib29rIG5vdycsICdyZXNlcnZlJywgJ2Nob29zZSBwbGFuJywgJ3NlbGVjdCBwbGFuJywgJ1x1MDYyN1x1MDYyOFx1MDYyRlx1MDYyMyBcdTA2MjdcdTA2NDRcdTA2MjJcdTA2NDYnLCAnXHUwNjI3XHUwNjI4XHUwNjJGXHUwNjIzIFx1MDY0NVx1MDYyQ1x1MDYyN1x1MDY0Nlx1MDYyNycsICdcdTA2MjVcdTA2NDZcdTA2MzRcdTA2MjdcdTA2MjEgXHUwNjJEXHUwNjMzXHUwNjI3XHUwNjI4JywgJ1x1MDYyN1x1MDY0Nlx1MDYzNFx1MDYyN1x1MDYyMSBcdTA2MkRcdTA2MzNcdTA2MjdcdTA2MjgnLCAnXHUwNjI3XHUwNjJEXHUwNjJDXHUwNjMyIFx1MDYyN1x1MDY0NFx1MDYyMlx1MDY0NicsICdcdTA2MjdcdTA2MkVcdTA2MkFcdTA2MzEgXHUwNjI3XHUwNjQ0XHUwNjJFXHUwNjM3XHUwNjI5J107XG5jb25zdCBDSEFUX1RFWFRTID0gWydjaGF0JywgJ2Fzc2lzdGFudCcsICdsaXZlIGNoYXQnLCAnc3VwcG9ydCcsICdoZWxwJywgJ2FzayB1cycsICdcdTA2MjdcdTA2NDRcdTA2MkZcdTA2MzFcdTA2MkZcdTA2MzRcdTA2MjknLCAnXHUwNjI3XHUwNjQ0XHUwNjQ1XHUwNjMzXHUwNjI3XHUwNjM5XHUwNjJGJywgJ1x1MDYyN1x1MDY0NFx1MDYyRlx1MDYzOVx1MDY0NScsICdcdTA2NDVcdTA2MzNcdTA2MjdcdTA2MzlcdTA2MkZcdTA2MjknLCAnXHUwNjJBXHUwNjQ4XHUwNjI3XHUwNjM1XHUwNjQ0IFx1MDY0NVx1MDYzOVx1MDY0Nlx1MDYyNyddO1xuY29uc3QgT1BUSU9OX1NFTEVDVE9SUyA9IFtcbiAgJ1tjbGFzcyo9XCJzaXplXCIgaV0gYnV0dG9uJywgJ1tjbGFzcyo9XCJzaXplXCIgaV0gW3JvbGU9XCJidXR0b25cIl0nLCAnW2NsYXNzKj1cInNpemVcIiBpXSBsYWJlbCcsXG4gICdbY2xhc3MqPVwidmFyaWFudFwiIGldIGJ1dHRvbicsICdbY2xhc3MqPVwib3B0aW9uXCIgaV0gYnV0dG9uJyxcbiAgJ2J1dHRvblthcmlhLWxhYmVsKj1cInNpemVcIiBpXScsICdbZGF0YS1vcHRpb25dIGJ1dHRvbicsXG5dO1xuY29uc3QgQ0hBVF9MQVVOQ0hFUl9TRUxFQ1RPUlMgPSBbXG4gICdbY2xhc3MqPVwiY2hhdC13aWRnZXRcIiBpXScsICdbY2xhc3MqPVwiY2hhdHdpZGdldFwiIGldJywgJ1tpZCo9XCJjaGF0LXdpZGdldFwiIGldJyxcbiAgJ1tjbGFzcyo9XCJsaXZlY2hhdFwiIGldJywgJ1tpZCo9XCJsaXZlY2hhdFwiIGldJywgJ1tjbGFzcyo9XCJsaXZlLWNoYXRcIiBpXScsXG4gICdbY2xhc3MqPVwiY2hhdC1sYXVuY2hlclwiIGldJywgJ1tjbGFzcyo9XCJjaGF0LWJ1dHRvblwiIGldJywgJ1tjbGFzcyo9XCJjaGF0Ym90XCIgaV0nLFxuICAnW2FyaWEtbGFiZWwqPVwiY2hhdFwiIGldJywgJ1thcmlhLWxhYmVsKj1cImFzc2lzdGFudFwiIGldJywgJ1thcmlhLWxhYmVsKj1cInN1cHBvcnRcIiBpXScsXG4gICdpZnJhbWVbdGl0bGUqPVwiY2hhdFwiIGldJywgJ2lmcmFtZVt0aXRsZSo9XCJhc3Npc3RhbnRcIiBpXScsXG5dO1xuXG4vKiogVHJ5IGVhY2ggY2FuZGlkYXRlIGxvY2F0b3IvdGV4dCBpbiBvcmRlcjsgY2xpY2sgYW5kIHJldHVybiB0cnVlIG9uIHRoZSBmaXJzdCB2aXNpYmxlIGhpdC4gKi9cbmFzeW5jIGZ1bmN0aW9uIHRyeUNsaWNrRmlyc3RWaXNpYmxlKHBhZ2U6IFBhZ2UsIHNlbGVjdG9yczogc3RyaW5nW10sIHRleHRzOiBzdHJpbmdbXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIHNlbGVjdG9ycykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbCA9IHBhZ2UubG9jYXRvcihzZWxlY3RvcikuZmlyc3QoKTtcbiAgICAgIGlmICgoYXdhaXQgZWwuY291bnQoKSkgJiYgKGF3YWl0IGVsLmlzVmlzaWJsZSgpLmNhdGNoKCgpID0+IGZhbHNlKSkpIHtcbiAgICAgICAgYXdhaXQgZWwuY2xpY2soeyB0aW1lb3V0OiA0MDAwIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHsgLyogdHJ5IHRoZSBuZXh0IGNhbmRpZGF0ZSAqLyB9XG4gIH1cbiAgZm9yIChjb25zdCB0ZXh0IG9mIHRleHRzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVsID0gcGFnZS5nZXRCeVRleHQodGV4dCwgeyBleGFjdDogZmFsc2UgfSkuZmlyc3QoKTtcbiAgICAgIGlmICgoYXdhaXQgZWwuY291bnQoKSkgJiYgKGF3YWl0IGVsLmlzVmlzaWJsZSgpLmNhdGNoKCgpID0+IGZhbHNlKSkpIHtcbiAgICAgICAgYXdhaXQgZWwuY2xpY2soeyB0aW1lb3V0OiA0MDAwIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHsgLyogdHJ5IHRoZSBuZXh0IGNhbmRpZGF0ZSAqLyB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIEJlc3QtZWZmb3J0IHJlYWwgaW50ZXJhY3Rpb24gc3RhdGVzIHRoYXQgYSBwdXJlbHkgbGluay1jcmF3bGluZyBjYXB0dXJlXG4gKiBjYW4gbmV2ZXIgcmVhY2ggb24gaXRzIG93bjogYSBwcm9kdWN0IHdpdGggYSByZWFsIG9wdGlvbiBzZWxlY3RlZCwgYW5cbiAqIGl0ZW0gYWN0dWFsbHkgYWRkZWQgdG8gdGhlIGNhcnQsIHRoZSBjYXJ0IGl0c2VsZiwgYSBjaGVja291dCBlbnRyeVxuICogc3RhdGUgKHdpdGhvdXQgc3VibWl0dGluZyBhbnkgcGF5bWVudC9vcmRlciksIGEgZ2VuZXJpYyBjb252ZXJzaW9uIGVudHJ5XG4gKiBzdGF0ZSBmb3Igbm9uLXN0b3JlIHNpdGVzLCBhbmQgYW4gb3BlbmVkIEFJIGFzc2lzdGFudC9saXZlLWNoYXQgd2lkZ2V0LiBFdmVyeSBzdGVwIGlzIGlzb2xhdGVkXG4gKiBhbmQgb3B0aW9uYWwgXHUyMDE0IGEgc2l0ZSB3aXRoIGRpZmZlcmVudCBtYXJrdXAgc2ltcGx5IHlpZWxkcyBmZXdlciBvZiB0aGVzZVxuICogZXh0cmEgY2FwdHVyZXMsIGFuZCB0aGlzIG5ldmVyIGZhaWxzIG9yIHNsb3dzIGRvd24gdGhlIGNvcmUgY2FwdHVyZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY2FwdHVyZUludGVyYWN0aW9uU3RhdGVzKFxuICBicm93c2VyOiBCcm93c2VyLFxuICBqb2JJZDogc3RyaW5nLFxuICBzb3VyY2VVcmw6IHN0cmluZyxcbiAgZGlzY292ZXJlZFBhZ2VzOiBDYXB0dXJlZFBhZ2VbXSxcbiAgZGVhZGxpbmVBdDogbnVtYmVyLFxuKTogUHJvbWlzZTxDYXB0dXJlZFBhZ2VbXT4ge1xuICBjb25zdCBleHRyYTogQ2FwdHVyZWRQYWdlW10gPSBbXTtcbiAgaWYgKERhdGUubm93KCkgPj0gZGVhZGxpbmVBdCAtIDE1XzAwMCkgcmV0dXJuIGV4dHJhO1xuXG4gIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoeyB2aWV3cG9ydDogVklFV1BPUlQsIGRldmljZVNjYWxlRmFjdG9yOiAxIH0pO1xuICBhd2FpdCBjb250ZXh0LnJvdXRlKCcqKi8qJywgZ3VhcmROYXZpZ2F0aW9uKTtcblxuICB0cnkge1xuICAgIC8vIDEpIFByb2R1Y3QgcGFnZSBcdTIxOTIgc2VsZWN0IGEgcmVhbCBvcHRpb24gXHUyMTkyIGFkZCB0byBjYXJ0IFx1MjE5MiB2aWV3IGNhcnQgXHUyMTkyIGNoZWNrb3V0IGVudHJ5LlxuICAgIGNvbnN0IHByb2R1Y3RDYW5kaWRhdGUgPSBkaXNjb3ZlcmVkUGFnZXMuZmluZCgocCkgPT4gL3Byb2R1Y3R8c2hvcHxpdGVtfGRyZXNzfHNob2V8YmFnfGRldGFpbC9pLnRlc3QocC51cmwpKSA/PyBkaXNjb3ZlcmVkUGFnZXNbMV07XG4gICAgaWYgKHByb2R1Y3RDYW5kaWRhdGUgJiYgRGF0ZS5ub3coKSA8IGRlYWRsaW5lQXQgLSAxNV8wMDApIHtcbiAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTtcbiAgICAgIGNvbmZpZ3VyZVBhZ2UocGFnZSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB3aXRoVGltZW91dCgoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHBhZ2UuZ290byhwcm9kdWN0Q2FuZGlkYXRlLnVybCwgeyB3YWl0VW50aWw6ICdkb21jb250ZW50bG9hZGVkJywgdGltZW91dDogMzBfMDAwIH0pO1xuICAgICAgICAgIGF3YWl0IHdhaXRGb3JSZWFkeShwYWdlLCBmYWxzZSk7XG5cbiAgICAgICAgICBjb25zdCBzZWxlY3RlZE9wdGlvbiA9IGF3YWl0IHRyeUNsaWNrRmlyc3RWaXNpYmxlKHBhZ2UsIE9QVElPTl9TRUxFQ1RPUlMsIFtdKTtcbiAgICAgICAgICBpZiAoc2VsZWN0ZWRPcHRpb24pIHtcbiAgICAgICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoNDAwKTtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICAgIGV4dHJhLnB1c2goeyB1cmw6IHBhZ2UudXJsKCksIHRpdGxlOiAnUHJvZHVjdCBwYWdlIFx1MjAxNCByZWFsIG9wdGlvbiBzZWxlY3RlZCcsIHNjcmVlbnNob3RVcmw6IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdpbnRlcmFjdGlvbi1wcm9kdWN0LXNlbGVjdGVkLmpwZycsIGJ1ZmZlcikgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgYWRkZWQgPSBhd2FpdCB0cnlDbGlja0ZpcnN0VmlzaWJsZShwYWdlLCBbXSwgQUREX1RPX0NBUlRfVEVYVFMpO1xuICAgICAgICAgIGlmIChhZGRlZCkge1xuICAgICAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCg3MDApO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdFBhZ2UocGFnZSwgZmFsc2UpO1xuICAgICAgICAgICAgZXh0cmEucHVzaCh7IHVybDogcGFnZS51cmwoKSwgdGl0bGU6ICdBZGRlZCB0byBjYXJ0Jywgc2NyZWVuc2hvdFVybDogYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ2ludGVyYWN0aW9uLWFkZGVkLXRvLWNhcnQuanBnJywgYnVmZmVyKSB9KTtcblxuICAgICAgICAgICAgY29uc3Qgb3BlbmVkQ2FydCA9IGF3YWl0IHRyeUNsaWNrRmlyc3RWaXNpYmxlKHBhZ2UsIENBUlRfU0VMRUNUT1JTLCBDQVJUX1RFWFRTKTtcbiAgICAgICAgICAgIGlmIChvcGVuZWRDYXJ0KSB7XG4gICAgICAgICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoNjAwKTtcbiAgICAgICAgICAgICAgY29uc3QgY2FydEJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgZXh0cmEucHVzaCh7IHVybDogcGFnZS51cmwoKSwgdGl0bGU6ICdTaG9wcGluZyBjYXJ0Jywgc2NyZWVuc2hvdFVybDogYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ2ludGVyYWN0aW9uLWNhcnQuanBnJywgY2FydEJ1ZmZlcikgfSk7XG5cbiAgICAgICAgICAgICAgLy8gQ2FwdHVyZSBvbmx5IHRoZSBjaGVja291dCBFTlRSWSBzdGF0ZS4gTmV2ZXIgZmlsbCBwYXltZW50IGZpZWxkcyxcbiAgICAgICAgICAgICAgLy8gc3VibWl0IGFuIG9yZGVyLCBvciBjbGljayBhIGZpbmFsIHB1cmNoYXNlL2NvbmZpcm1hdGlvbiBjb250cm9sLlxuICAgICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lQXQgLSA3XzAwMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5lZENoZWNrb3V0ID0gYXdhaXQgdHJ5Q2xpY2tGaXJzdFZpc2libGUocGFnZSwgQ0hFQ0tPVVRfU0VMRUNUT1JTLCBDSEVDS09VVF9URVhUUyk7XG4gICAgICAgICAgICAgICAgaWYgKG9wZW5lZENoZWNrb3V0KSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDgwMCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjaGVja291dEJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgIGV4dHJhLnB1c2goeyB1cmw6IHBhZ2UudXJsKCksIHRpdGxlOiAnQ2hlY2tvdXQgXHUyMDE0IHJlYWwgZW50cnkgc3RhdGUnLCBzY3JlZW5zaG90VXJsOiBhd2FpdCBzYXZlSW1hZ2VGaWxlKGpvYklkLCAnaW50ZXJhY3Rpb24tY2hlY2tvdXQuanBnJywgY2hlY2tvdXRCdWZmZXIpIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSkoKSwgMjhfMDAwLCAnUFJPRFVDVF9JTlRFUkFDVElPTicpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW2NhcHR1cmVdIHByb2R1Y3QgaW50ZXJhY3Rpb24gc2tpcHBlZDonLCAoZXJyIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGF3YWl0IHBhZ2UuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gMikgR2VuZXJpYyBjb252ZXJzaW9uIGVudHJ5IGZvciBTYWFTL3NlcnZpY2UvYm9va2luZyBzaXRlcy4gVGhpcyBvbmx5XG4gICAgLy8gbmF2aWdhdGVzIHRvIHRoZSBmaXJzdCByZWFsIHNpZ251cC9ib29raW5nL3BsYW4gZW50cnkgc3RhdGU7IGl0IG5ldmVyXG4gICAgLy8gc3VibWl0cyBhIGZvcm0sIGNyZWF0ZXMgYW4gYWNjb3VudCwgYm9va3MsIG9yIHB1cmNoYXNlcyBhbnl0aGluZy5cbiAgICBpZiAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lQXQgLSAxMF8wMDApIHtcbiAgICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTtcbiAgICAgIGNvbmZpZ3VyZVBhZ2UocGFnZSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB3aXRoVGltZW91dCgoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHBhZ2UuZ290byhzb3VyY2VVcmwsIHsgd2FpdFVudGlsOiAnZG9tY29udGVudGxvYWRlZCcsIHRpbWVvdXQ6IDMwXzAwMCB9KTtcbiAgICAgICAgICBhd2FpdCB3YWl0Rm9yUmVhZHkocGFnZSwgZmFsc2UpO1xuICAgICAgICAgIGNvbnN0IG9wZW5lZCA9IGF3YWl0IHRyeUNsaWNrRmlyc3RWaXNpYmxlKHBhZ2UsIFtdLCBDT05WRVJTSU9OX1RFWFRTKTtcbiAgICAgICAgICBpZiAob3BlbmVkKSB7XG4gICAgICAgICAgICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDgwMCk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShwYWdlLCBmYWxzZSk7XG4gICAgICAgICAgICBleHRyYS5wdXNoKHsgdXJsOiBwYWdlLnVybCgpLCB0aXRsZTogJ0NvbnZlcnNpb24gLyBzaWdudXAgLyBib29raW5nIGVudHJ5IHN0YXRlJywgc2NyZWVuc2hvdFVybDogYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ2ludGVyYWN0aW9uLWNvbnZlcnNpb24uanBnJywgYnVmZmVyKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCksIDE4XzAwMCwgJ0NPTlZFUlNJT05fRU5UUlknKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tjYXB0dXJlXSBjb252ZXJzaW9uIGVudHJ5IHNraXBwZWQ6JywgKGVyciBhcyBFcnJvcikubWVzc2FnZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBhd2FpdCBwYWdlLmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIDMpIEFJIGFzc2lzdGFudCAvIGxpdmUtY2hhdCB3aWRnZXQsIGlmIHRoZSBzaXRlIGhhcyBvbmUuXG4gICAgaWYgKERhdGUubm93KCkgPCBkZWFkbGluZUF0IC0gMTBfMDAwKSB7XG4gICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7XG4gICAgICBjb25maWd1cmVQYWdlKHBhZ2UpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd2l0aFRpbWVvdXQoKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCBwYWdlLmdvdG8oc291cmNlVXJsLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAzMF8wMDAgfSk7XG4gICAgICAgICAgYXdhaXQgd2FpdEZvclJlYWR5KHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICBjb25zdCBvcGVuZWQgPSBhd2FpdCB0cnlDbGlja0ZpcnN0VmlzaWJsZShwYWdlLCBDSEFUX0xBVU5DSEVSX1NFTEVDVE9SUywgQ0hBVF9URVhUUyk7XG4gICAgICAgICAgaWYgKG9wZW5lZCkge1xuICAgICAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCgxMDAwKTtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICAgIGV4dHJhLnB1c2goeyB1cmw6IHBhZ2UudXJsKCksIHRpdGxlOiAnQUkgYXNzaXN0YW50IC8gbGl2ZSBjaGF0Jywgc2NyZWVuc2hvdFVybDogYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ2ludGVyYWN0aW9uLWFpLWFzc2lzdGFudC5qcGcnLCBidWZmZXIpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKSwgMjBfMDAwLCAnQ0hBVF9XSURHRVQnKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tjYXB0dXJlXSBjaGF0IHdpZGdldCBza2lwcGVkOicsIChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgYXdhaXQgcGFnZS5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgY29udGV4dC5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgfVxuICByZXR1cm4gZXh0cmE7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNhcHR1cmVTaXRlTm93KGpvYklkOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nLCBvblByb2dyZXNzPzogQ2FwdHVyZVByb2dyZXNzKTogUHJvbWlzZTxTaXRlQ2FwdHVyZT4ge1xuICBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICBjb25zdCBkZWFkbGluZUF0ID0gc3RhcnRlZEF0ICsgQ0FQVFVSRV9CVURHRVRfTVM7XG4gIGNvbnN0IGRpciA9IHBhdGguam9pbihBU1NFVFNfRElSLCBqb2JJZCk7XG4gIGNvbnN0IHZpZGVvRGlyID0gcGF0aC5qb2luKGRpciwgJ2Jyb3dzZXItdmlkZW8nKTtcbiAgYXdhaXQgZW5zdXJlRGlyKHZpZGVvRGlyKTtcblxuICBhd2FpdCBvblByb2dyZXNzPy4oOCwgJ09wZW5pbmcgeW91ciB3ZWJzaXRlIHNlY3VyZWx5JywgMTUwKTtcbiAgY29uc3QgYnJvd3NlciA9IGF3YWl0IGNocm9taXVtLmxhdW5jaCh7XG4gICAgaGVhZGxlc3M6IHRydWUsXG4gICAgdGltZW91dDogMzBfMDAwLFxuICAgIGFyZ3M6IFsnLS1uby1zYW5kYm94JywgJy0tZGlzYWJsZS1kZXYtc2htLXVzYWdlJywgJy0tZGlzYWJsZS1iYWNrZ3JvdW5kLXRpbWVyLXRocm90dGxpbmcnXSxcbiAgfSk7XG5cbiAgdHJ5IHtcbiAgICAvLyBDb3JlIGRlc2t0b3AgY2FwdHVyZTogbm8gdmlkZW8gcmVjb3JkaW5nIGhlcmUuIFRoaXMga2VlcHMgbG9hZGluZy9sYXp5XG4gICAgLy8gaHlkcmF0aW9uIHdvcmsgb3V0IG9mIHRoZSB1c2VyJ3Mgc21vb3RoLXNjcm9sbCByZWNvcmRpbmcuXG4gICAgY29uc3QgY29udGV4dCA9IGF3YWl0IGJyb3dzZXIubmV3Q29udGV4dCh7XG4gICAgICB2aWV3cG9ydDogVklFV1BPUlQsXG4gICAgICBkZXZpY2VTY2FsZUZhY3RvcjogMSxcbiAgICAgIHVzZXJBZ2VudDogJ01vemlsbGEvNS4wIChYMTE7IExpbnV4IHg4Nl82NCkgQXBwbGVXZWJLaXQvNTM3LjM2IENocm9tZS8xMjYgU2FmYXJpLzUzNy4zNiBBaVdlYlZpZGVvQ2FwdHVyZS8zLjAnLFxuICAgIH0pO1xuICAgIGF3YWl0IGNvbnRleHQucm91dGUoJyoqLyonLCBndWFyZE5hdmlnYXRpb24pO1xuICAgIGNvbnN0IHBhZ2UgPSBhd2FpdCBjb250ZXh0Lm5ld1BhZ2UoKTtcbiAgICBjb25maWd1cmVQYWdlKHBhZ2UpO1xuICAgIGF3YWl0IG9uUHJvZ3Jlc3M/LigxMiwgJ0xvYWRpbmcgdGhlIGhvbWVwYWdlJywgMTI1KTtcbiAgICBjb25zb2xlLmluZm8oYFtjYXB0dXJlXSBvcGVuaW5nICR7c291cmNlVXJsfWApO1xuICAgIGF3YWl0IHBhZ2UuZ290byhzb3VyY2VVcmwsIHsgd2FpdFVudGlsOiAnZG9tY29udGVudGxvYWRlZCcsIHRpbWVvdXQ6IDQwXzAwMCB9KTtcbiAgICBhd2FpdCB3YWl0Rm9yUmVhZHkocGFnZSwgdHJ1ZSk7XG4gICAgYXdhaXQgb25Qcm9ncmVzcz8uKDIwLCAnU2F2aW5nIHRoZSBmdWxseSBsb2FkZWQgaG9tZXBhZ2UnLCAxMDApO1xuXG4gICAgY29uc3QgbWV0YSA9IGF3YWl0IGNvbGxlY3RNZXRhZGF0YShwYWdlLCBzb3VyY2VVcmwpO1xuICAgIGNvbnN0IHVybHMgPSBhd2FpdCBkaXNjb3ZlckludGVybmFsUGFnZXMocGFnZSwgc291cmNlVXJsKTtcbiAgICBjb25zdCB2aWV3cG9ydEJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIGZhbHNlKTtcbiAgICBjb25zdCBmdWxsQnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdFBhZ2UocGFnZSwgdHJ1ZSk7XG4gICAgY29uc3Qgc2NyZWVuc2hvdFVybCA9IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdzY3JlZW5zaG90LmpwZycsIHZpZXdwb3J0QnVmZmVyKTtcbiAgICBjb25zdCBmdWxsUGFnZVNjcmVlbnNob3RVcmwgPSBhd2FpdCBzYXZlSW1hZ2VGaWxlKGpvYklkLCAnc2NyZWVuc2hvdC1mdWxsLmpwZycsIGZ1bGxCdWZmZXIpO1xuICAgIGNvbnN0IHdlYnNpdGVJY29uVXJsID0gYXdhaXQgY2FwdHVyZVdlYnNpdGVJY29uKHBhZ2UsIGpvYklkLCBtZXRhLmljb25VcmwgfHwgbWV0YS5sb2dvVXJsLCBtZXRhLnRpdGxlLCBtZXRhLmJyYW5kQ29sb3JzWzBdKTtcbiAgICBjb25zb2xlLmluZm8oYFtjYXB0dXJlXSBzdWNjZXNzICR7c291cmNlVXJsfSBzY3JlZW5zaG90LmpwZyArIHNjcmVlbnNob3QtZnVsbC5qcGdgKTtcbiAgICBhd2FpdCBwYWdlLmNsb3NlKCk7XG4gICAgYXdhaXQgY29udGV4dC5jbG9zZSgpO1xuICAgIGF3YWl0IG9uUHJvZ3Jlc3M/LigyNywgJ0hvbWVwYWdlIGNhcHR1cmVkIGluIGZ1bGwgcXVhbGl0eScsIDgwKTtcblxuICAgIC8vIE9wdGlvbmFsIHNtb290aC1zY3JvbGwgcmVjb3JkaW5nLiBGYWlsdXJlIG5ldmVyIGRlc3Ryb3lzIHNjcmVlbnNob3RzLlxuICAgIGxldCByZWNvcmRpbmdVcmw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGlmIChEYXRlLm5vdygpIDwgZGVhZGxpbmVBdCAtIDI1XzAwMCkge1xuICAgICAgYXdhaXQgb25Qcm9ncmVzcz8uKDI5LCAnU2F2aW5nIGEgc21vb3RoLXNjcm9sbCBwcmV2aWV3JywgNjUpO1xuICAgICAgY29uc3QgcmVjb3JkaW5nQ29udGV4dCA9IGF3YWl0IGJyb3dzZXIubmV3Q29udGV4dCh7XG4gICAgICAgIHZpZXdwb3J0OiBWSUVXUE9SVCxcbiAgICAgICAgZGV2aWNlU2NhbGVGYWN0b3I6IDEsXG4gICAgICAgIHJlY29yZFZpZGVvOiB7IGRpcjogdmlkZW9EaXIsIHNpemU6IFZJRVdQT1JUIH0sXG4gICAgICAgIHVzZXJBZ2VudDogJ01vemlsbGEvNS4wIChYMTE7IExpbnV4IHg4Nl82NCkgQXBwbGVXZWJLaXQvNTM3LjM2IENocm9tZS8xMjYgU2FmYXJpLzUzNy4zNiBBaVdlYlZpZGVvQ2FwdHVyZS8zLjAnLFxuICAgICAgfSk7XG4gICAgICBhd2FpdCByZWNvcmRpbmdDb250ZXh0LnJvdXRlKCcqKi8qJywgZ3VhcmROYXZpZ2F0aW9uKTtcbiAgICAgIGNvbnN0IHJlY29yZGluZ1BhZ2UgPSBhd2FpdCByZWNvcmRpbmdDb250ZXh0Lm5ld1BhZ2UoKTtcbiAgICAgIGNvbmZpZ3VyZVBhZ2UocmVjb3JkaW5nUGFnZSk7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB2aWRlb0Nsb2NrU3RhcnRlZCA9IERhdGUubm93KCk7XG4gICAgICAgIGF3YWl0IHJlY29yZGluZ1BhZ2UuZ290byhzb3VyY2VVcmwsIHsgd2FpdFVudGlsOiAnZG9tY29udGVudGxvYWRlZCcsIHRpbWVvdXQ6IDM1XzAwMCB9KTtcbiAgICAgICAgYXdhaXQgd2FpdEZvclJlYWR5KHJlY29yZGluZ1BhZ2UsIGZhbHNlKTtcbiAgICAgICAgY29uc3QgdHJpbVN0YXJ0ID0gTWF0aC5tYXgoMCwgKERhdGUubm93KCkgLSB2aWRlb0Nsb2NrU3RhcnRlZCkgLyAxMDAwKTtcbiAgICAgICAgY29uc3QgdG91ckR1cmF0aW9uID0gYXdhaXQgcmVjb3JkU21vb3RoU2Nyb2xsKHJlY29yZGluZ1BhZ2UpO1xuICAgICAgICBjb25zdCByZWNvcmRpbmcgPSByZWNvcmRpbmdQYWdlLnZpZGVvKCk7XG4gICAgICAgIGF3YWl0IHJlY29yZGluZ1BhZ2UuY2xvc2UoKTtcbiAgICAgICAgYXdhaXQgcmVjb3JkaW5nQ29udGV4dC5jbG9zZSgpO1xuICAgICAgICBpZiAocmVjb3JkaW5nKSB7XG4gICAgICAgICAgY29uc3Qgd2VibVBhdGggPSBhd2FpdCByZWNvcmRpbmcucGF0aCgpO1xuICAgICAgICAgIGNvbnN0IG1wNFBhdGggPSBwYXRoLmpvaW4oZGlyLCAnc2Nyb2xsLXJlY29yZGluZy5tcDQnKTtcbiAgICAgICAgICBhd2FpdCBjb252ZXJ0UmVjb3JkaW5nKHdlYm1QYXRoLCBtcDRQYXRoLCB0cmltU3RhcnQsIHRvdXJEdXJhdGlvbik7XG4gICAgICAgICAgcmVjb3JkaW5nVXJsID0gYC9hcGkvYXNzZXRzLyR7am9iSWR9L3Njcm9sbC1yZWNvcmRpbmcubXA0YDtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW2NhcHR1cmVdIHNtb290aC1zY3JvbGwgcHJldmlldyBza2lwcGVkOicsIChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgICAgICBhd2FpdCByZWNvcmRpbmdQYWdlLmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgICBhd2FpdCByZWNvcmRpbmdDb250ZXh0LmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlc3BvbnNpdmUgbW9iaWxlIGNhcHR1cmUgaXMgb3B0aW9uYWwgYW5kIGlzb2xhdGVkIGZyb20gZGVza3RvcCBzdWNjZXNzLlxuICAgIGxldCBtb2JpbGVTY3JlZW5zaG90VXJsOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbW9iaWxlRnVsbFBhZ2VTY3JlZW5zaG90VXJsOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBpZiAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lQXQgLSAyMF8wMDApIHtcbiAgICAgIGNvbnN0IG1vYmlsZUNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoe1xuICAgICAgICB2aWV3cG9ydDogTU9CSUxFX1ZJRVdQT1JULFxuICAgICAgICBzY3JlZW46IE1PQklMRV9WSUVXUE9SVCxcbiAgICAgICAgZGV2aWNlU2NhbGVGYWN0b3I6IDEsXG4gICAgICAgIGlzTW9iaWxlOiB0cnVlLFxuICAgICAgICBoYXNUb3VjaDogdHJ1ZSxcbiAgICAgICAgdXNlckFnZW50OiAnTW96aWxsYS81LjAgKGlQaG9uZTsgQ1BVIGlQaG9uZSBPUyAxN181IGxpa2UgTWFjIE9TIFgpIEFwcGxlV2ViS2l0LzYwNS4xLjE1IFZlcnNpb24vMTcuNSBNb2JpbGUvMTVFMTQ4IFNhZmFyaS82MDQuMSBBaVdlYlZpZGVvQ2FwdHVyZS8zLjAnLFxuICAgICAgfSk7XG4gICAgICBhd2FpdCBtb2JpbGVDb250ZXh0LnJvdXRlKCcqKi8qJywgZ3VhcmROYXZpZ2F0aW9uKTtcbiAgICAgIGNvbnN0IG1vYmlsZVBhZ2UgPSBhd2FpdCBtb2JpbGVDb250ZXh0Lm5ld1BhZ2UoKTtcbiAgICAgIGNvbmZpZ3VyZVBhZ2UobW9iaWxlUGFnZSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBvblByb2dyZXNzPy4oMzIsICdTYXZpbmcgdGhlIHJlYWwgbW9iaWxlIGxheW91dCcsIDU1KTtcbiAgICAgICAgYXdhaXQgbW9iaWxlUGFnZS5nb3RvKHNvdXJjZVVybCwgeyB3YWl0VW50aWw6ICdkb21jb250ZW50bG9hZGVkJywgdGltZW91dDogMzVfMDAwIH0pO1xuICAgICAgICBhd2FpdCB3YWl0Rm9yUmVhZHkobW9iaWxlUGFnZSwgZmFsc2UpO1xuICAgICAgICBjb25zdCBtb2JpbGVWaWV3cG9ydEJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKG1vYmlsZVBhZ2UsIGZhbHNlKTtcbiAgICAgICAgY29uc3QgbW9iaWxlRnVsbEJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKG1vYmlsZVBhZ2UsIHRydWUpO1xuICAgICAgICBtb2JpbGVTY3JlZW5zaG90VXJsID0gYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ3NjcmVlbnNob3QtbW9iaWxlLmpwZycsIG1vYmlsZVZpZXdwb3J0QnVmZmVyKTtcbiAgICAgICAgbW9iaWxlRnVsbFBhZ2VTY3JlZW5zaG90VXJsID0gYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ3NjcmVlbnNob3QtbW9iaWxlLWZ1bGwuanBnJywgbW9iaWxlRnVsbEJ1ZmZlcik7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbY2FwdHVyZV0gbW9iaWxlIGxheW91dCBza2lwcGVkOicsIChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgYXdhaXQgbW9iaWxlUGFnZS5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgICAgYXdhaXQgbW9iaWxlQ29udGV4dC5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDaGlsZCBwYWdlcyBzaGFyZSBvbmUgbGlnaHR3ZWlnaHQgY29udGV4dC4gRWFjaCBwYWdlIGhhcyBpdHMgb3duIGxvY2FsXG4gICAgLy8gYnVkZ2V0OyBvbmUgc2xvdyByb3V0ZSBzdWNoIGFzIC9vdXItbG9jYXRpb24gb3IgL3NhbGVzIGNhbiBiZSBza2lwcGVkXG4gICAgLy8gd2l0aG91dCBraWxsaW5nIHRoZSBicm93c2VyIG9yIGludmFsaWRhdGluZyBhbGwgcHJldmlvdXMgc2NyZWVuc2hvdHMuXG4gICAgY29uc3QgcGFnZXM6IENhcHR1cmVkUGFnZVtdID0gW3sgdXJsOiBzb3VyY2VVcmwsIHRpdGxlOiBtZXRhLnRpdGxlLCBzY3JlZW5zaG90VXJsOiBmdWxsUGFnZVNjcmVlbnNob3RVcmwgfV07XG4gICAgbGV0IHNraXBwZWRQYWdlcyA9IDA7XG4gICAgY29uc3QgY2hpbGRDb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHsgdmlld3BvcnQ6IFZJRVdQT1JULCBkZXZpY2VTY2FsZUZhY3RvcjogMSB9KTtcbiAgICBhd2FpdCBjaGlsZENvbnRleHQucm91dGUoJyoqLyonLCBndWFyZE5hdmlnYXRpb24pO1xuICAgIHRyeSB7XG4gICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHVybHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKERhdGUubm93KCkgPj0gZGVhZGxpbmVBdCAtIDEyXzAwMCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW2NhcHR1cmVdIHNvZnQgYnVkZ2V0IHJlYWNoZWQgYWZ0ZXIgJHtwYWdlcy5sZW5ndGh9IHBhZ2Uocyk7IHJldHVybmluZyBzdWNjZXNzZnVsIHBhcnRpYWwgY2FwdHVyZWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNoaWxkID0gYXdhaXQgY2hpbGRDb250ZXh0Lm5ld1BhZ2UoKTtcbiAgICAgICAgY29uZmlndXJlUGFnZShjaGlsZCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgb25Qcm9ncmVzcz8uKFxuICAgICAgICAgICAgMzMgKyBNYXRoLnJvdW5kKChpIC8gTWF0aC5tYXgoMSwgdXJscy5sZW5ndGggLSAxKSkgKiA2KSxcbiAgICAgICAgICAgIGBDYXB0dXJpbmcgcGFnZSAke2kgKyAxfSBvZiAke3VybHMubGVuZ3RofWAsXG4gICAgICAgICAgICBNYXRoLm1heCgxMCwgKHVybHMubGVuZ3RoIC0gaSkgKiAxMiksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zb2xlLmluZm8oYFtjYXB0dXJlXSBvcGVuaW5nICR7dXJsc1tpXX1gKTtcbiAgICAgICAgICBhd2FpdCB3aXRoVGltZW91dCgoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgY2hpbGQuZ290byh1cmxzW2ldLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAzMl8wMDAgfSk7XG4gICAgICAgICAgICBhd2FpdCB3YWl0Rm9yUmVhZHkoY2hpbGQsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkTWV0YSA9IGF3YWl0IGNvbGxlY3RNZXRhZGF0YShjaGlsZCwgdXJsc1tpXSk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShjaGlsZCwgdHJ1ZSk7XG4gICAgICAgICAgICBjb25zdCBwYWdlU2NyZWVuc2hvdFVybCA9IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsIGBwYWdlLSR7aX0uanBnYCwgYnVmZmVyKTtcbiAgICAgICAgICAgIHBhZ2VzLnB1c2goeyB1cmw6IGNoaWxkLnVybCgpLCB0aXRsZTogY2hpbGRNZXRhLnRpdGxlLCBzY3JlZW5zaG90VXJsOiBwYWdlU2NyZWVuc2hvdFVybCB9KTtcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhgW2NhcHR1cmVdIHN1Y2Nlc3MgJHt1cmxzW2ldfSBwYWdlLSR7aX0uanBnYCk7XG4gICAgICAgICAgfSkoKSwgTWF0aC5taW4oQ0hJTERfUEFHRV9CVURHRVRfTVMsIE1hdGgubWF4KDEyXzAwMCwgZGVhZGxpbmVBdCAtIERhdGUubm93KCkgLSA1XzAwMCkpLCAnQ0hJTERfUEFHRScpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBza2lwcGVkUGFnZXMrKztcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtjYXB0dXJlXSBza2lwcGVkICR7dXJsc1tpXX0gJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgIGF3YWl0IGNoaWxkLmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGF3YWl0IGNoaWxkQ29udGV4dC5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmluZm8oYFtjYXB0dXJlXSBmaW5pc2hlZCBzdWNjZXNzZnVsPSR7cGFnZXMubGVuZ3RofSBmYWlsZWQ9JHtza2lwcGVkUGFnZXN9YCk7XG4gICAgLy8gcGFnZUNvdW50IHJlZmxlY3RzIGRpc3RpbmN0IHNpdGUgcGFnZXMgdmlzaXRlZCwgc2hvd24gdG8gdGhlIHVzZXIgYXNcbiAgICAvLyBcIk4gcGFnZXMgY2FwdHVyZWRcIi4gSW50ZXJhY3Rpb24tc3RhdGUgc2NyZWVuc2hvdHMgYmVsb3cgYXJlIGV4dHJhXG4gICAgLy8gc3RhdGVzIG9mIHBhZ2VzIGFscmVhZHkgY291bnRlZCBoZXJlIChlLmcuIFwicHJvZHVjdCB3aXRoIGEgc2l6ZVxuICAgIC8vIHNlbGVjdGVkXCIpLCBub3QgbmV3IHBhZ2VzLCBzbyB0aGV5J3JlIGFwcGVuZGVkIHRvIGBwYWdlc2AgZm9yIHRoZSBBSVxuICAgIC8vIHBsYW5uZXIgd2l0aG91dCBpbmZsYXRpbmcgdGhhdCBjb3VudC5cbiAgICBjb25zdCBwYWdlQ291bnQgPSBwYWdlcy5sZW5ndGg7XG5cbiAgICAvLyBCZXN0LWVmZm9ydCByZWFsIGludGVyYWN0aW9uIHN0YXRlcyAocHJvZHVjdCBvcHRpb24gc2VsZWN0ZWQsIGFkZGVkIHRvXG4gICAgLy8gY2FydCwgY2FydCB2aWV3LCBBSSBhc3Npc3RhbnQgb3BlbmVkKS4gVGhlc2UgYXJlIHdoYXQgbWFrZSBidXkvdG91ci9cbiAgICAvLyB0dXRvcmlhbCB2aWRlb3MgYWJsZSB0byBzaG93IGEgcmVhbCBwdXJjaGFzZSBqb3VybmV5IGFuZCBhIHJlYWxcbiAgICAvLyBhc3Npc3RhbnQgd2lkZ2V0IGluc3RlYWQgb2Ygb25seSBzdGF0aWMgbGFuZGluZyBwYWdlcy5cbiAgICBpZiAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lQXQgLSAxNV8wMDApIHtcbiAgICAgIGF3YWl0IG9uUHJvZ3Jlc3M/LigzOCwgJ0NhcHR1cmluZyByZWFsIGludGVyYWN0aW9ucyAob3B0aW9ucywgY2FydCwgY2hlY2tvdXQsIGNvbnZlcnNpb24sIGNoYXQpJywgMjApO1xuICAgICAgY29uc3QgaW50ZXJhY3Rpb25QYWdlcyA9IGF3YWl0IGNhcHR1cmVJbnRlcmFjdGlvblN0YXRlcyhicm93c2VyLCBqb2JJZCwgc291cmNlVXJsLCBwYWdlcywgZGVhZGxpbmVBdCk7XG4gICAgICBpZiAoaW50ZXJhY3Rpb25QYWdlcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5pbmZvKGBbY2FwdHVyZV0gaW50ZXJhY3Rpb24gc3RhdGVzIGNhcHR1cmVkPSR7aW50ZXJhY3Rpb25QYWdlcy5sZW5ndGh9YCk7XG4gICAgICAgIHBhZ2VzLnB1c2goLi4uaW50ZXJhY3Rpb25QYWdlcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgb25Qcm9ncmVzcz8uKDQwLCBgV2Vic2l0ZSBjYXB0dXJlIGNvbXBsZXRlIFx1MjAxNCAke3BhZ2VDb3VudH0gcGFnZSR7cGFnZUNvdW50ID09PSAxID8gJycgOiAncyd9IHNhdmVkYCwgMCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLm1ldGEsXG4gICAgICBsb2dvVXJsOiB3ZWJzaXRlSWNvblVybCA/PyBtZXRhLmxvZ29VcmwsXG4gICAgICBzY3JlZW5zaG90VXJsLFxuICAgICAgZnVsbFBhZ2VTY3JlZW5zaG90VXJsLFxuICAgICAgbW9iaWxlU2NyZWVuc2hvdFVybCxcbiAgICAgIG1vYmlsZUZ1bGxQYWdlU2NyZWVuc2hvdFVybCxcbiAgICAgIHJlY29yZGluZ1VybCxcbiAgICAgIHBhZ2VzLFxuICAgICAgcGFnZUNvdW50LFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSAoZXJyIGFzIEVycm9yKS5tZXNzYWdlO1xuICAgIGlmICgvdGltZW91dC9pLnRlc3QobWVzc2FnZSkgfHwgRGF0ZS5ub3coKSA+PSBkZWFkbGluZUF0KSB0aHJvdyBuZXcgRXJyb3IoJ0NBUFRVUkVfVElNRU9VVCcpO1xuICAgIHRocm93IGVycjtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBicm93c2VyLmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIC8vIFBsYXl3cmlnaHQgc3RvcmVzIGl0cyByYXcgV2ViTSBpbiBicm93c2VyLXZpZGVvLy4gVGhlIGZpbmFsIHRyaW1tZWQgTVA0XG4gICAgLy8gbGl2ZXMgYXQgdGhlIGpvYiByb290LCBzbyByZW1vdmUgdGhlIHJhdyBjYXB0dXJlIHRvIGF2b2lkIGRpc2sgZ3Jvd3RoLlxuICAgIGF3YWl0IGZzLnJtKHZpZGVvRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSkuY2F0Y2goKCkgPT4ge30pO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYXB0dXJlU2l0ZShqb2JJZDogc3RyaW5nLCBzb3VyY2VVcmw6IHN0cmluZywgb25Qcm9ncmVzcz86IENhcHR1cmVQcm9ncmVzcyk6IFByb21pc2U8U2l0ZUNhcHR1cmU+IHtcbiAgYXdhaXQgb25Qcm9ncmVzcz8uKFxuICAgIDUsXG4gICAgYWN0aXZlQ2FwdHVyZXMgPj0gQ0FQVFVSRV9DT05DVVJSRU5DWSA/ICdXYWl0aW5nIGZvciBhbiBhdmFpbGFibGUgY2FwdHVyZSBzbG90JyA6ICdQcmVwYXJpbmcgd2Vic2l0ZSBjYXB0dXJlJyxcbiAgICBhY3RpdmVDYXB0dXJlcyA+PSBDQVBUVVJFX0NPTkNVUlJFTkNZID8gMTgwIDogMTUwLFxuICApO1xuICBhd2FpdCBhY3F1aXJlQ2FwdHVyZVNsb3QoKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgY2FwdHVyZVNpdGVOb3coam9iSWQsIHNvdXJjZVVybCwgb25Qcm9ncmVzcyk7XG4gIH0gZmluYWxseSB7XG4gICAgcmVsZWFzZUNhcHR1cmVTbG90KCk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoU2NyZWVuc2hvdCh1cmw6IHN0cmluZyk6IFByb21pc2U8eyBzY3JlZW5zaG90VXJsOiBzdHJpbmc7IHNjcmVlbnNob3RCdWZmZXI6IEJ1ZmZlciB9PiB7XG4gIGNvbnN0IHNjcmVlbnNob3RVcmwgPSBgaHR0cHM6Ly9pbWFnZS50aHVtLmlvL2dldC93aWR0aC8xNDQwL2Nyb3AvOTAwLyR7dXJsfWA7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChzY3JlZW5zaG90VXJsLCB7IHNpZ25hbDogQWJvcnRTaWduYWwudGltZW91dCgyMF8wMDApIH0pO1xuICAgIGlmICghcmVzcG9uc2Uub2spIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICByZXR1cm4geyBzY3JlZW5zaG90VXJsLCBzY3JlZW5zaG90QnVmZmVyOiBCdWZmZXIuZnJvbShhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpKSB9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4geyBzY3JlZW5zaG90VXJsLCBzY3JlZW5zaG90QnVmZmVyOiBCdWZmZXIuYWxsb2MoMCkgfTtcbiAgfVxufVxuIiwgImltcG9ydCBkbnMgZnJvbSAnZG5zL3Byb21pc2VzJztcbmltcG9ydCBpcGFkZHIgZnJvbSAnaXBhZGRyLmpzJztcblxuY29uc3QgQkxPQ0tFRF9TQ0hFTUVTID0gbmV3IFNldChbJ2ZpbGUnLCAnZnRwJywgJ2dvcGhlcicsICdkYXRhJywgJ2RpY3QnLCAnc210cCcsICdsZGFwJ10pO1xuXG4vLyBSYW5nZXMgdGhhdCBpcGFkZHIuanMncyBhZGRyLnJhbmdlKCkgcmV0dXJucyBmb3Igbm9uLXB1YmxpYyBhZGRyZXNzZXNcbmNvbnN0IFBSSVZBVEVfUkFOR0VTID0gbmV3IFNldChbXG4gICdwcml2YXRlJyxcbiAgJ2xvb3BiYWNrJyxcbiAgJ2xpbmtMb2NhbCcsXG4gICdtdWx0aWNhc3QnLFxuICAndW5zcGVjaWZpZWQnLFxuICAnY2FycmllckdyYWRlTmF0JyxcbiAgJ2Jyb2FkY2FzdCcsXG4gICdyZXNlcnZlZCcsXG4gICd1bmlxdWVMb2NhbCcsICAgLy8gSVB2NiBVTEEgKGZjMDA6Oi83KVxuICAnaXB2NE1hcHBlZCcsICAgIC8vIGJsb2NrIDo6ZmZmZjoxMC54LngueCBldGNcbl0pO1xuXG5leHBvcnQgY2xhc3MgU3NyZkVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnU3NyZkVycm9yJztcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1ByaXZhdGVJUChpcDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWRkciA9IGlwYWRkci5wYXJzZShpcCk7XG4gICAgY29uc3QgcmFuZ2UgPSBhZGRyLnJhbmdlKCk7XG4gICAgcmV0dXJuIFBSSVZBVEVfUkFOR0VTLmhhcyhyYW5nZSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIElmIGlwYWRkciBjYW4ndCBwYXJzZSBpdCwgdHJlYXQgYXMgc2FmZSBcdTIwMTQgRE5TIGFscmVhZHkgcmVzb2x2ZWQgaXQsXG4gICAgLy8gc28gaXQncyBhIHZhbGlkIGFkZHJlc3MgZm9ybWF0IHdlIGp1c3QgZG9uJ3QgcmVjb2duaXplLlxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmFsaWRhdGVVcmwocmF3VXJsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICBsZXQgcGFyc2VkOiBVUkw7XG4gIHRyeSB7XG4gICAgcGFyc2VkID0gbmV3IFVSTChyYXdVcmwpO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgU3NyZkVycm9yKCdJbnZhbGlkIFVSTCBmb3JtYXQuJyk7XG4gIH1cblxuICBjb25zdCBzY2hlbWUgPSBwYXJzZWQucHJvdG9jb2wucmVwbGFjZSgnOicsICcnKTtcbiAgaWYgKEJMT0NLRURfU0NIRU1FUy5oYXMoc2NoZW1lKSkge1xuICAgIHRocm93IG5ldyBTc3JmRXJyb3IoYFNjaGVtZSBcIiR7cGFyc2VkLnByb3RvY29sfVwiIGlzIG5vdCBhbGxvd2VkLmApO1xuICB9XG4gIGlmICghWydodHRwOicsICdodHRwczonXS5pbmNsdWRlcyhwYXJzZWQucHJvdG9jb2wpKSB7XG4gICAgdGhyb3cgbmV3IFNzcmZFcnJvcignT25seSBodHRwIGFuZCBodHRwcyBVUkxzIGFyZSBhbGxvd2VkLicpO1xuICB9XG5cbiAgY29uc3QgaG9zdG5hbWUgPSBwYXJzZWQuaG9zdG5hbWU7XG5cbiAgLy8gSWYgdGhlIGhvc3QgaXMgYWxyZWFkeSBhIHJhdyBJUCwgY2hlY2sgaXQgZGlyZWN0bHlcbiAgaWYgKGlwYWRkci5pc1ZhbGlkKGhvc3RuYW1lKSkge1xuICAgIGlmIChpc1ByaXZhdGVJUChob3N0bmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBTc3JmRXJyb3IoJ0FjY2VzcyB0byBwcml2YXRlIElQIGFkZHJlc3NlcyBpcyBub3QgYWxsb3dlZC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZC50b1N0cmluZygpO1xuICB9XG5cbiAgLy8gUmVzb2x2ZSBob3N0bmFtZSBhbmQgY2hlY2sgYWxsIHJldHVybmVkIElQc1xuICBsZXQgYWRkcmVzc2VzOiB7IGFkZHJlc3M6IHN0cmluZyB9W107XG4gIHRyeSB7XG4gICAgYWRkcmVzc2VzID0gYXdhaXQgZG5zLmxvb2t1cChob3N0bmFtZSwgeyBhbGw6IHRydWUgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBTc3JmRXJyb3IoYENhbm5vdCByZXNvbHZlIGhvc3QgXCIke2hvc3RuYW1lfVwiLmApO1xuICB9XG5cbiAgaWYgKCFhZGRyZXNzZXMgfHwgYWRkcmVzc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBTc3JmRXJyb3IoYENhbm5vdCByZXNvbHZlIGhvc3QgXCIke2hvc3RuYW1lfVwiLmApO1xuICB9XG5cbiAgZm9yIChjb25zdCB7IGFkZHJlc3MgfSBvZiBhZGRyZXNzZXMpIHtcbiAgICBpZiAoaXNQcml2YXRlSVAoYWRkcmVzcykpIHtcbiAgICAgIHRocm93IG5ldyBTc3JmRXJyb3IoYEhvc3QgXCIke2hvc3RuYW1lfVwiIHJlc29sdmVzIHRvIGEgcHJpdmF0ZSBJUCBhZGRyZXNzLmApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKTtcbn1cbiIsICJpbXBvcnQgeyBxdWVyeSB9IGZyb20gJy4vcG9vbC5qcyc7XG5cbmV4cG9ydCB0eXBlIE1lZGlhS2luZCA9ICdpbWFnZScgfCAndmlkZW8nO1xuZXhwb3J0IHR5cGUgUHJvdmlkZXJDaG9pY2UgPSAnYXV0bycgfCAnZ2VtaW5pJyB8ICdvcGVuX3NvdXJjZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvdmlkZXJTZXR0aW5ncyB7XG4gIGltYWdlOiBQcm92aWRlckNob2ljZTtcbiAgdmlkZW86IFByb3ZpZGVyQ2hvaWNlO1xuICBmYWxsYmFja0VuYWJsZWQ6IGJvb2xlYW47XG59XG5cbmNvbnN0IGRlZmF1bHRzOiBQcm92aWRlclNldHRpbmdzID0geyBpbWFnZTogJ2F1dG8nLCB2aWRlbzogJ2F1dG8nLCBmYWxsYmFja0VuYWJsZWQ6IHRydWUgfTtcbmxldCBjYWNoZTogeyB2YWx1ZTogUHJvdmlkZXJTZXR0aW5nczsgZXhwaXJlczogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcbmV4cG9ydCBpbnRlcmZhY2UgT3BlcmF0aW9uc1NldHRpbmdzIHtcbiAgbWFpbnRlbmFuY2VNb2RlOiBib29sZWFuO1xuICByZWdpc3RyYXRpb25zRW5hYmxlZDogYm9vbGVhbjtcbiAgbWF4Q29uY3VycmVudEpvYnM6IG51bWJlcjtcbn1cbmNvbnN0IG9wZXJhdGlvbkRlZmF1bHRzOiBPcGVyYXRpb25zU2V0dGluZ3MgPSB7IG1haW50ZW5hbmNlTW9kZTogZmFsc2UsIHJlZ2lzdHJhdGlvbnNFbmFibGVkOiB0cnVlLCBtYXhDb25jdXJyZW50Sm9iczogMyB9O1xubGV0IG9wZXJhdGlvbnNDYWNoZTogeyB2YWx1ZTogT3BlcmF0aW9uc1NldHRpbmdzOyBleHBpcmVzOiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0UHJvdmlkZXJTZXR0aW5ncygpOiBQcm9taXNlPFByb3ZpZGVyU2V0dGluZ3M+IHtcbiAgaWYgKGNhY2hlICYmIGNhY2hlLmV4cGlyZXMgPiBEYXRlLm5vdygpKSByZXR1cm4gY2FjaGUudmFsdWU7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8eyB2YWx1ZTogUGFydGlhbDxQcm92aWRlclNldHRpbmdzPiB9PihcbiAgICBgU0VMRUNUIHZhbHVlIEZST00gc3lzdGVtX3NldHRpbmdzIFdIRVJFIGtleT0ncHJvdmlkZXJzJyBMSU1JVCAxYCxcbiAgKS5jYXRjaCgoKSA9PiAoeyByb3dzOiBbXSBhcyBBcnJheTx7IHZhbHVlOiBQYXJ0aWFsPFByb3ZpZGVyU2V0dGluZ3M+IH0+IH0pKTtcbiAgY29uc3QgdmFsdWUgPSB7IC4uLmRlZmF1bHRzLCAuLi4ocm93c1swXT8udmFsdWUgPz8ge30pIH07XG4gIGNhY2hlID0geyB2YWx1ZSwgZXhwaXJlczogRGF0ZS5ub3coKSArIDVfMDAwIH07XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyUHJvdmlkZXJTZXR0aW5nc0NhY2hlKCkge1xuICBjYWNoZSA9IG51bGw7XG4gIG9wZXJhdGlvbnNDYWNoZSA9IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPcGVyYXRpb25zU2V0dGluZ3MoKTogUHJvbWlzZTxPcGVyYXRpb25zU2V0dGluZ3M+IHtcbiAgaWYgKG9wZXJhdGlvbnNDYWNoZSAmJiBvcGVyYXRpb25zQ2FjaGUuZXhwaXJlcyA+IERhdGUubm93KCkpIHJldHVybiBvcGVyYXRpb25zQ2FjaGUudmFsdWU7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8eyB2YWx1ZTogUGFydGlhbDxPcGVyYXRpb25zU2V0dGluZ3M+IH0+KFxuICAgIGBTRUxFQ1QgdmFsdWUgRlJPTSBzeXN0ZW1fc2V0dGluZ3MgV0hFUkUga2V5PSdvcGVyYXRpb25zJyBMSU1JVCAxYCxcbiAgKS5jYXRjaCgoKSA9PiAoeyByb3dzOiBbXSBhcyBBcnJheTx7IHZhbHVlOiBQYXJ0aWFsPE9wZXJhdGlvbnNTZXR0aW5ncz4gfT4gfSkpO1xuICBjb25zdCByYXcgPSB7IC4uLm9wZXJhdGlvbkRlZmF1bHRzLCAuLi4ocm93c1swXT8udmFsdWUgPz8ge30pIH07XG4gIGNvbnN0IHZhbHVlID0geyAuLi5yYXcsIG1heENvbmN1cnJlbnRKb2JzOiBNYXRoLm1heCgxLCBNYXRoLm1pbigyMCwgTnVtYmVyKHJhdy5tYXhDb25jdXJyZW50Sm9icykgfHwgMykpIH07XG4gIG9wZXJhdGlvbnNDYWNoZSA9IHsgdmFsdWUsIGV4cGlyZXM6IERhdGUubm93KCkgKyA1XzAwMCB9O1xuICByZXR1cm4gdmFsdWU7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9kdWN0aW9uQ2FwYWNpdHkoKSB7XG4gIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0T3BlcmF0aW9uc1NldHRpbmdzKCk7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8eyBhY3RpdmU6IG51bWJlciB9PihcbiAgICBgU0VMRUNUIENPVU5UKCopOjppbnQgYWN0aXZlIEZST00gam9icyBXSEVSRSBkZWxldGVkX2F0IElTIE5VTEwgQU5EIHN0YXR1cyBJTiAoJ3F1ZXVlZCcsJ2NhcHR1cmluZycsJ3N0b3J5Ym9hcmRpbmcnLCdyZW5kZXJpbmcnKWAsXG4gICk7XG4gIHJldHVybiB7IGFjdGl2ZTogcm93c1swXT8uYWN0aXZlID8/IDAsIG1heGltdW06IHNldHRpbmdzLm1heENvbmN1cnJlbnRKb2JzIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlckF2YWlsYWJpbGl0eShraW5kOiBNZWRpYUtpbmQpIHtcbiAgY29uc3Qgb3BlblNvdXJjZSA9IGtpbmQgPT09ICdpbWFnZSdcbiAgICA/IEJvb2xlYW4ocHJvY2Vzcy5lbnYuUlVOUE9EX0lNQUdFX0VORFBPSU5UX0lEIHx8IHByb2Nlc3MuZW52LkdQVV9JTUFHRV9FTkRQT0lOVCB8fCBwcm9jZXNzLmVudi5HUFVfU0VSVkVSX1VSTClcbiAgICA6IEJvb2xlYW4ocHJvY2Vzcy5lbnYuUlVOUE9EX1ZJREVPX0VORFBPSU5UX0lEIHx8IHByb2Nlc3MuZW52LkdQVV9WSURFT19FTkRQT0lOVCB8fCBwcm9jZXNzLmVudi5HUFVfU0VSVkVSX1VSTCk7XG4gIHJldHVybiB7XG4gICAgZ2VtaW5pOiBCb29sZWFuKHByb2Nlc3MuZW52LkdFTUlOSV9BUElfS0VZKSxcbiAgICBvcGVuU291cmNlLFxuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZVByb3ZpZGVyKGtpbmQ6IE1lZGlhS2luZCk6IFByb21pc2U8J2dlbWluaScgfCAnb3Blbl9zb3VyY2UnPiB7XG4gIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0UHJvdmlkZXJTZXR0aW5ncygpO1xuICBjb25zdCBzZWxlY3RlZCA9IHNldHRpbmdzW2tpbmRdO1xuICBjb25zdCBhdmFpbGFiaWxpdHkgPSBwcm92aWRlckF2YWlsYWJpbGl0eShraW5kKTtcbiAgY29uc3QgcmVzb2x2ZWQgPSAodmFsdWU6ICdnZW1pbmknIHwgJ29wZW5fc291cmNlJykgPT4ge1xuICAgIGNvbnNvbGUuaW5mbyhgW3Byb3ZpZGVyXSBmZWF0dXJlPSR7a2luZH0gcmVxdWVzdGVkPSR7c2VsZWN0ZWR9IHJlc29sdmVkPSR7dmFsdWV9YCk7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuICBpZiAoc2VsZWN0ZWQgPT09ICdnZW1pbmknKSB7XG4gICAgaWYgKCFhdmFpbGFiaWxpdHkuZ2VtaW5pKSB0aHJvdyBuZXcgRXJyb3IoYFRoZSBzZWxlY3RlZCAke2tpbmR9IHByb3ZpZGVyIGlzIG5vdCBjb25maWd1cmVkLmApO1xuICAgIHJldHVybiByZXNvbHZlZCgnZ2VtaW5pJyk7XG4gIH1cbiAgaWYgKHNlbGVjdGVkID09PSAnb3Blbl9zb3VyY2UnKSB7XG4gICAgaWYgKCFhdmFpbGFiaWxpdHkub3BlblNvdXJjZSkgdGhyb3cgbmV3IEVycm9yKGBUaGUgc2VsZWN0ZWQgb3Blbi1zb3VyY2UgJHtraW5kfSBwcm92aWRlciBpcyBub3QgY29uZmlndXJlZC5gKTtcbiAgICByZXR1cm4gcmVzb2x2ZWQoJ29wZW5fc291cmNlJyk7XG4gIH1cbiAgLy8gSW4gQXV0byBtb2RlLCBwcmVmZXIgR2VtaW5pIHdoZW4gY29uZmlndXJlZC4gRm9yIHZpZGVvIHRoaXMgc2VsZWN0cyB0aGVcbiAgLy8gbmF0aXZlLWF1ZGlvLCBmaXJzdC9sYXN0LWZyYW1lIEFJIHBhdGggdXNlZCBmb3IgZ3JvdW5kZWQgd2Vic2l0ZSBhY3Rpb25zO1xuICAvLyBhZG1pbnMgY2FuIHN0aWxsIGV4cGxpY2l0bHkgY2hvb3NlIG9wZW5fc291cmNlIGZvciBjb3N0L3Rocm91Z2hwdXQuXG4gIGlmIChhdmFpbGFiaWxpdHkuZ2VtaW5pKSByZXR1cm4gcmVzb2x2ZWQoJ2dlbWluaScpO1xuICBpZiAoYXZhaWxhYmlsaXR5Lm9wZW5Tb3VyY2UpIHJldHVybiByZXNvbHZlZCgnb3Blbl9zb3VyY2UnKTtcbiAgdGhyb3cgbmV3IEVycm9yKGBObyAke2tpbmR9IGdlbmVyYXRpb24gcHJvdmlkZXIgaXMgY29uZmlndXJlZC5gKTtcbn1cbiIsICJpbXBvcnQgKiBhcyBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGV4ZWNGaWxlIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ25vZGU6dXRpbCc7XG5pbXBvcnQgeyBBU1NFVFNfRElSLCBzYXZlSW1hZ2VGaWxlIH0gZnJvbSAnLi9jYXB0dXJlLmpzJztcbmltcG9ydCB7IHF1ZXJ5IH0gZnJvbSAnLi9wb29sLmpzJztcbmltcG9ydCB7IHJlY29yZEdlbmVyYXRpb25Db3N0IH0gZnJvbSAnLi9jb3N0cy5qcyc7XG5cbmNvbnN0IGV4ZWNGaWxlQXN5bmMgPSBwcm9taXNpZnkoZXhlY0ZpbGUpO1xuXG50eXBlIEtpbmQgPSAnaW1hZ2UnIHwgJ3ZpZGVvJztcblxuaW50ZXJmYWNlIEdwdVJlc3BvbnNlIHtcbiAgZGF0YT86IHN0cmluZztcbiAgdXJsPzogc3RyaW5nO1xuICBncHVTZWNvbmRzPzogbnVtYmVyO1xuICBtb2RlbD86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnQoa2luZDogS2luZCkge1xuICBjb25zdCBkaXJlY3QgPSBraW5kID09PSAnaW1hZ2UnID8gcHJvY2Vzcy5lbnYuR1BVX0lNQUdFX0VORFBPSU5UIDogcHJvY2Vzcy5lbnYuR1BVX1ZJREVPX0VORFBPSU5UO1xuICBjb25zdCBiYXNlID0gcHJvY2Vzcy5lbnYuR1BVX1NFUlZFUl9VUkw/LnJlcGxhY2UoL1xcLyQvLCAnJyk7XG4gIHJldHVybiBkaXJlY3QgfHwgKGJhc2UgPyBgJHtiYXNlfS92MS9nZW5lcmF0ZS8ke2tpbmR9YCA6IG51bGwpO1xufVxuXG5mdW5jdGlvbiBydW5wb2RFbmRwb2ludChraW5kOiBLaW5kKSB7XG4gIGNvbnN0IGlkID0ga2luZCA9PT0gJ2ltYWdlJyA/IHByb2Nlc3MuZW52LlJVTlBPRF9JTUFHRV9FTkRQT0lOVF9JRCA6IHByb2Nlc3MuZW52LlJVTlBPRF9WSURFT19FTkRQT0lOVF9JRDtcbiAgcmV0dXJuIGlkID8gYGh0dHBzOi8vYXBpLnJ1bnBvZC5haS92Mi8ke2lkfWAgOiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VsZkhvc3RlZEVuYWJsZWQoa2luZDogS2luZCkge1xuICByZXR1cm4gQm9vbGVhbihlbmRwb2ludChraW5kKSB8fCBydW5wb2RFbmRwb2ludChraW5kKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlY29yZChqb2JJZDogc3RyaW5nLCBraW5kOiBLaW5kLCByZXNwb25zZTogR3B1UmVzcG9uc2UsIGVsYXBzZWRTZWNvbmRzOiBudW1iZXIpIHtcbiAgY29uc3Qgc2Vjb25kcyA9IE51bWJlci5pc0Zpbml0ZShyZXNwb25zZS5ncHVTZWNvbmRzKSA/IE1hdGgubWF4KDAsIE51bWJlcihyZXNwb25zZS5ncHVTZWNvbmRzKSkgOiBlbGFwc2VkU2Vjb25kcztcbiAgY29uc3QgcmF0ZSA9IE51bWJlcihwcm9jZXNzLmVudi5HUFVfQ09TVF9QRVJfU0VDT05EX1VTRCA/PyAwKTtcbiAgY29uc3QgbW9kZWwgPSByZXNwb25zZS5tb2RlbCB8fCAoa2luZCA9PT0gJ2ltYWdlJyA/ICdmbHV4Mi1rbGVpbi00YicgOiAnd2FuMi4yLXRpMnYtNWInKTtcbiAgYXdhaXQgcXVlcnkoYFVQREFURSBqb2JzIFNFVCBncHVfc2Vjb25kcz1DT0FMRVNDRShncHVfc2Vjb25kcywwKSskMSx1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQyYCwgW3NlY29uZHMsIGpvYklkXSkuY2F0Y2goKCkgPT4ge30pO1xuICBhd2FpdCByZWNvcmRHZW5lcmF0aW9uQ29zdCh7XG4gICAgam9iSWQsIHByb3ZpZGVyOiAnc2VsZi1ob3N0ZWQnLCBtb2RlbCwgb3BlcmF0aW9uOiBgJHtraW5kfV9nZW5lcmF0aW9uYCxcbiAgICBxdWFudGl0eTogc2Vjb25kcywgdW5pdDogJ2dwdV9zZWNvbmQnLCB1bml0Q29zdFVzZDogTWF0aC5tYXgoMCwgcmF0ZSksXG4gIH0pO1xufVxuXG50eXBlIENhbmNlbENoZWNrID0gKCkgPT4gUHJvbWlzZTxib29sZWFuPjtcblxuZnVuY3Rpb24gcmVxdWVzdFRpbWVvdXRNcyhraW5kOiBLaW5kKSB7XG4gIGNvbnN0IHNwZWNpZmljID0ga2luZCA9PT0gJ3ZpZGVvJyA/IHByb2Nlc3MuZW52LkdQVV9WSURFT19SRVFVRVNUX1RJTUVPVVRfTVMgOiBwcm9jZXNzLmVudi5HUFVfSU1BR0VfUkVRVUVTVF9USU1FT1VUX01TO1xuICBjb25zdCBmYWxsYmFjayA9IHByb2Nlc3MuZW52LkdQVV9SRVFVRVNUX1RJTUVPVVRfTVM7XG4gIGNvbnN0IGRlZmF1bHRNcyA9IGtpbmQgPT09ICd2aWRlbycgPyAxMiAqIDYwXzAwMCA6IDUgKiA2MF8wMDA7XG4gIHJldHVybiBNYXRoLm1heCgzMF8wMDAsIE51bWJlcihzcGVjaWZpYyA/PyBmYWxsYmFjayA/PyBkZWZhdWx0TXMpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVxdWVzdChraW5kOiBLaW5kLCBqb2JJZDogc3RyaW5nLCBib2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgc2hvdWxkQ2FuY2VsPzogQ2FuY2VsQ2hlY2spIHtcbiAgY29uc3QgcnVucG9kID0gcnVucG9kRW5kcG9pbnQoa2luZCk7XG4gIGlmIChydW5wb2QpIHJldHVybiByZXF1ZXN0UnVucG9kKHJ1bnBvZCwga2luZCwgam9iSWQsIGJvZHksIHNob3VsZENhbmNlbCk7XG4gIGNvbnN0IHVybCA9IGVuZHBvaW50KGtpbmQpO1xuICBpZiAoIXVybCkgdGhyb3cgbmV3IEVycm9yKGBTZWxmLWhvc3RlZCAke2tpbmR9IGVuZHBvaW50IGlzIG5vdCBjb25maWd1cmVkLmApO1xuICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG4gIGNvbnN0IHRpbWVvdXRNcyA9IHJlcXVlc3RUaW1lb3V0TXMoa2luZCk7XG4gIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgdGltZW91dE1zKTtcbiAgY29uc3QgY2FuY2VsV2F0Y2ggPSBzaG91bGRDYW5jZWwgPyBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgdm9pZCBzaG91bGRDYW5jZWwoKS50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgaWYgKCF2YWx1ZSB8fCBjYW5jZWxsZWQpIHJldHVybjtcbiAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgfSkuY2F0Y2goKCkgPT4ge30pO1xuICB9LCAxNTAwKSA6IG51bGw7XG4gIGNvbnN0IHN0YXJ0ZWQgPSBEYXRlLm5vdygpO1xuICBjb25zb2xlLmluZm8oYFtncHUtJHtraW5kfV0gam9iPSR7am9iSWR9IGRpcmVjdF9yZXF1ZXN0X3N0YXJ0ZWQgdGltZW91dF9zPSR7TWF0aC5yb3VuZCh0aW1lb3V0TXMgLyAxMDAwKX1gKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIC4uLihwcm9jZXNzLmVudi5HUFVfU0VSVkVSX1NFQ1JFVCA/IHsgYXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Byb2Nlc3MuZW52LkdQVV9TRVJWRVJfU0VDUkVUfWAgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICB9KTtcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEdQVSB3b3JrZXIgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9LmApO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyBHcHVSZXNwb25zZTtcbiAgICBpZiAoIXJlc3VsdC5kYXRhICYmICFyZXN1bHQudXJsKSB0aHJvdyBuZXcgRXJyb3IoJ0dQVSB3b3JrZXIgcmV0dXJuZWQgbm8gZ2VuZXJhdGVkIGZpbGUuJyk7XG4gICAgYXdhaXQgcmVjb3JkKGpvYklkLCBraW5kLCByZXN1bHQsIChEYXRlLm5vdygpIC0gc3RhcnRlZCkgLyAxMDAwKTtcbiAgICBjb25zb2xlLmluZm8oYFtncHUtJHtraW5kfV0gam9iPSR7am9iSWR9IGRpcmVjdF9yZXF1ZXN0X2NvbXBsZXRlZCBlbGFwc2VkPSR7TWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIHN0YXJ0ZWQpIC8gMTAwMCl9c2ApO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGNhbmNlbGxlZCkgdGhyb3cgbmV3IEVycm9yKGBPcGVuLXNvdXJjZSAke2tpbmR9IGdlbmVyYXRpb24gd2FzIGNhbmNlbGxlZCBieSB0aGUgdXNlci5gKTtcbiAgICBpZiAoKGVycm9yIGFzIEVycm9yKS5uYW1lID09PSAnQWJvcnRFcnJvcicpIHRocm93IG5ldyBFcnJvcihgT3Blbi1zb3VyY2UgJHtraW5kfSBnZW5lcmF0aW9uIHRpbWVkIG91dCBhZnRlciAke01hdGgucm91bmQodGltZW91dE1zIC8gMTAwMCl9cy5gKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfSBmaW5hbGx5IHtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgaWYgKGNhbmNlbFdhdGNoKSBjbGVhckludGVydmFsKGNhbmNlbFdhdGNoKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZXF1ZXN0UnVucG9kKGJhc2VVcmw6IHN0cmluZywga2luZDogS2luZCwgam9iSWQ6IHN0cmluZywgYm9keTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHNob3VsZENhbmNlbD86IENhbmNlbENoZWNrKSB7XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LlJVTlBPRF9BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgdGhyb3cgbmV3IEVycm9yKCdSVU5QT0RfQVBJX0tFWSBpcyBub3QgY29uZmlndXJlZC4nKTtcbiAgY29uc3QgaGVhZGVycyA9IHsgYXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FwaUtleX1gLCAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH07XG4gIGNvbnN0IHN0YXJ0ZWQgPSBEYXRlLm5vdygpO1xuICBjb25zdCBzdWJtaXR0ZWQgPSBhd2FpdCBmZXRjaChgJHtiYXNlVXJsfS9ydW5gLCB7IG1ldGhvZDogJ1BPU1QnLCBoZWFkZXJzLCBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGlucHV0OiBib2R5IH0pIH0pO1xuICBpZiAoIXN1Ym1pdHRlZC5vaykgdGhyb3cgbmV3IEVycm9yKGBSdW5Qb2Qgc3VibWlzc2lvbiByZXR1cm5lZCAke3N1Ym1pdHRlZC5zdGF0dXN9LmApO1xuICBjb25zdCBzdWJtaXNzaW9uID0gYXdhaXQgc3VibWl0dGVkLmpzb24oKSBhcyB7IGlkPzogc3RyaW5nIH07XG4gIGlmICghc3VibWlzc2lvbi5pZCkgdGhyb3cgbmV3IEVycm9yKCdSdW5Qb2QgcmV0dXJuZWQgbm8gam9iIElELicpO1xuICBjb25zdCB0aW1lb3V0TXMgPSByZXF1ZXN0VGltZW91dE1zKGtpbmQpO1xuICBjb25zdCB0aW1lb3V0QXQgPSBEYXRlLm5vdygpICsgdGltZW91dE1zO1xuICBsZXQgbGFzdExvZ0F0ID0gMDtcbiAgY29uc29sZS5pbmZvKGBbZ3B1LSR7a2luZH1dIGpvYj0ke2pvYklkfSBydW5wb2Rfc3VibWl0dGVkIGlkPSR7c3VibWlzc2lvbi5pZH0gdGltZW91dF9zPSR7TWF0aC5yb3VuZCh0aW1lb3V0TXMgLyAxMDAwKX1gKTtcbiAgd2hpbGUgKERhdGUubm93KCkgPCB0aW1lb3V0QXQpIHtcbiAgICBpZiAoc2hvdWxkQ2FuY2VsICYmIGF3YWl0IHNob3VsZENhbmNlbCgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE9wZW4tc291cmNlICR7a2luZH0gZ2VuZXJhdGlvbiB3YXMgY2FuY2VsbGVkIGJ5IHRoZSB1c2VyLmApO1xuICAgIH1cbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGlmIChub3cgLSBsYXN0TG9nQXQgPj0gMzBfMDAwKSB7XG4gICAgICBsYXN0TG9nQXQgPSBub3c7XG4gICAgICBjb25zb2xlLmluZm8oYFtncHUtJHtraW5kfV0gam9iPSR7am9iSWR9IHJ1bnBvZF93YWl0aW5nIGlkPSR7c3VibWlzc2lvbi5pZH0gZWxhcHNlZD0ke01hdGgucm91bmQoKG5vdyAtIHN0YXJ0ZWQpIC8gMTAwMCl9c2ApO1xuICAgIH1cbiAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCAzMDAwKSk7XG4gICAgY29uc3Qgc3RhdHVzUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtiYXNlVXJsfS9zdGF0dXMvJHtzdWJtaXNzaW9uLmlkfWAsIHsgaGVhZGVycyB9KTtcbiAgICBpZiAoIXN0YXR1c1Jlc3BvbnNlLm9rKSB0aHJvdyBuZXcgRXJyb3IoYFJ1blBvZCBzdGF0dXMgcmV0dXJuZWQgJHtzdGF0dXNSZXNwb25zZS5zdGF0dXN9LmApO1xuICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IHN0YXR1c1Jlc3BvbnNlLmpzb24oKSBhcyB7IHN0YXR1cz86IHN0cmluZzsgb3V0cHV0PzogR3B1UmVzcG9uc2U7IGVycm9yPzogc3RyaW5nOyBleGVjdXRpb25UaW1lPzogbnVtYmVyIH07XG4gICAgaWYgKHN0YXR1cy5zdGF0dXMgPT09ICdDT01QTEVURUQnICYmIHN0YXR1cy5vdXRwdXQpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHsgLi4uc3RhdHVzLm91dHB1dCwgZ3B1U2Vjb25kczogc3RhdHVzLm91dHB1dC5ncHVTZWNvbmRzID8/IChzdGF0dXMuZXhlY3V0aW9uVGltZSA/IHN0YXR1cy5leGVjdXRpb25UaW1lIC8gMTAwMCA6IHVuZGVmaW5lZCkgfTtcbiAgICAgIGlmICghcmVzdWx0LmRhdGEgJiYgIXJlc3VsdC51cmwpIHRocm93IG5ldyBFcnJvcignUnVuUG9kIHdvcmtlciByZXR1cm5lZCBubyBnZW5lcmF0ZWQgZmlsZS4nKTtcbiAgICAgIGF3YWl0IHJlY29yZChqb2JJZCwga2luZCwgcmVzdWx0LCAoRGF0ZS5ub3coKSAtIHN0YXJ0ZWQpIC8gMTAwMCk7XG4gICAgICBjb25zb2xlLmluZm8oYFtncHUtJHtraW5kfV0gam9iPSR7am9iSWR9IHJ1bnBvZF9jb21wbGV0ZWQgaWQ9JHtzdWJtaXNzaW9uLmlkfSBlbGFwc2VkPSR7TWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIHN0YXJ0ZWQpIC8gMTAwMCl9c2ApO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgaWYgKHN0YXR1cy5zdGF0dXMgPT09ICdGQUlMRUQnIHx8IHN0YXR1cy5zdGF0dXMgPT09ICdDQU5DRUxMRUQnIHx8IHN0YXR1cy5zdGF0dXMgPT09ICdUSU1FRF9PVVQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RhdHVzLmVycm9yIHx8IGBSdW5Qb2Qgam9iICR7c3RhdHVzLnN0YXR1cy50b0xvd2VyQ2FzZSgpfS5gKTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBSdW5Qb2QgJHtraW5kfSBnZW5lcmF0aW9uIHRpbWVkIG91dCBhZnRlciAke01hdGgucm91bmQodGltZW91dE1zIC8gMTAwMCl9cy5gKTtcbn1cblxuZnVuY3Rpb24gZW5jb2RlZFJlZmVyZW5jZXMocmVmZXJlbmNlczogQnVmZmVyW10sIGxpbWl0OiBudW1iZXIpIHtcbiAgY29uc3Qgc2VsZWN0ZWQ6IHN0cmluZ1tdID0gW107XG4gIGxldCBieXRlcyA9IDA7XG4gIGZvciAoY29uc3QgaW1hZ2Ugb2YgcmVmZXJlbmNlcy5zbGljZSgwLCBsaW1pdCkpIHtcbiAgICBpZiAoYnl0ZXMgKyBpbWFnZS5sZW5ndGggPiA3ICogMTAyNCAqIDEwMjQpIGNvbnRpbnVlO1xuICAgIHNlbGVjdGVkLnB1c2goaW1hZ2UudG9TdHJpbmcoJ2Jhc2U2NCcpKTtcbiAgICBieXRlcyArPSBpbWFnZS5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIHNlbGVjdGVkO1xufVxuXG5hc3luYyBmdW5jdGlvbiBieXRlcyhyZXN1bHQ6IEdwdVJlc3BvbnNlKSB7XG4gIGlmIChyZXN1bHQuZGF0YSkgcmV0dXJuIEJ1ZmZlci5mcm9tKHJlc3VsdC5kYXRhLCAnYmFzZTY0Jyk7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2gocmVzdWx0LnVybCEpO1xuICBpZiAoIXJlc3BvbnNlLm9rKSB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBkb3dubG9hZCB0aGUgZ2VuZXJhdGVkIEdQVSBmaWxlLicpO1xuICByZXR1cm4gQnVmZmVyLmZyb20oYXdhaXQgcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUdwdUltYWdlKGpvYklkOiBzdHJpbmcsIHNjZW5lSW5kZXg6IG51bWJlciwgcHJvbXB0OiBzdHJpbmcsIHJlZmVyZW5jZXM6IEJ1ZmZlcltdLCBhc3BlY3RSYXRpbzogc3RyaW5nLCBxdWFsaXR5OiBzdHJpbmcpIHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdCgnaW1hZ2UnLCBqb2JJZCwge1xuICAgIG1vZGVsOiBwcm9jZXNzLmVudi5HUFVfSU1BR0VfTU9ERUwgPz8gJ2ZsdXgyLWtsZWluLTRiJywgcHJvbXB0LCBhc3BlY3RSYXRpbywgcXVhbGl0eSxcbiAgICByZWZlcmVuY2VzOiBlbmNvZGVkUmVmZXJlbmNlcyhyZWZlcmVuY2VzLCA0KSxcbiAgfSk7XG4gIHJldHVybiBzYXZlSW1hZ2VGaWxlKGpvYklkLCBgcGhvdG8tJHtzY2VuZUluZGV4fS0ke3F1YWxpdHl9LnBuZ2AsIGF3YWl0IGJ5dGVzKHJlc3VsdCkpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVHcHVWaWRlbyhqb2JJZDogc3RyaW5nLCBzY2VuZUluZGV4OiBudW1iZXIsIHByb21wdDogc3RyaW5nLCByZWZlcmVuY2VzOiBCdWZmZXJbXSwgYXNwZWN0UmF0aW86IHN0cmluZywgc2hvdWxkQ2FuY2VsPzogQ2FuY2VsQ2hlY2spIHtcbiAgLy8gVGhlIHNlbGYtaG9zdGVkIHdvcmtlciBydW5zIHdhbjIuMi10aTJ2LTViIGJ5IGRlZmF1bHQgXHUyMDE0IGEgc21hbGwgKDVCXG4gIC8vIHBhcmFtZXRlcikgb3BlbiB2aWRlbyBtb2RlbC4gVHdvIGNvbmNyZXRlLCBldmlkZW5jZS1iYXNlZCBpbXByb3ZlbWVudHNcbiAgLy8gb3ZlciB0aGUgcHJldmlvdXMgcmVxdWVzdCAod2hpY2ggc2VudCBub3RoaW5nIGJ1dCBwcm9tcHQvYXNwZWN0UmF0aW8pOlxuICAvLyAgIDEuIG5lZ2F0aXZlUHJvbXB0OiBXQU4yLjIgZXhwbGljaXRseSBzdXBwb3J0cyBuZWdhdGl2ZSBwcm9tcHRpbmcgZm9yXG4gIC8vICAgICAgY2xlYW51cCBvZiBleGFjdGx5IHRoZSBhcnRpZmFjdHMgdGhpcyBtb2RlbCBpcyBwcm9uZSB0byAoYmx1cixcbiAgLy8gICAgICBmbGlja2VyLCB3YXJwZWQgZGV0YWlsLCBleHRyYS9kaXN0b3J0ZWQgbGltYnMpLiBBZGRlZCBhcyBhIGJlc3QtXG4gIC8vICAgICAgZWZmb3J0IG9wdGlvbmFsIGZpZWxkIFx1MjAxNCBpZiB0aGUgZGVwbG95ZWQgd29ya2VyIGRvZXNuJ3QgcmVjb2duaXplXG4gIC8vICAgICAgaXQsIGl0J3Mgc2ltcGx5IGV4dHJhIEpTT04gdGhlIHdvcmtlciBpZ25vcmVzOyBub3RoaW5nIGJyZWFrcy5cbiAgLy8gICAyLiBUaGUgcHJvbXB0IGl0c2VsZiBhbHJlYWR5IGNhcnJpZXMgZnVsbCBjaW5lbWF0aWMgZGV0YWlsIGZyb20gdGhlXG4gIC8vICAgICAgc2hhcmVkIG1hc3RlciBwcm9tcHQgKHZlcmlmaWVkIGFnYWluc3QgY3VycmVudCBXQU4yLjIgcHJvbXB0aW5nXG4gIC8vICAgICAgZ3VpZGVzOiBpdCB3YW50cyBhIHN0cnVjdHVyZWQgODAtMTIwIHdvcmQgcHJvbXB0LCBub3QgYSBzaG9ydGVuZWRcbiAgLy8gICAgICBvbmUgXHUyMDE0IHVuZGVyLXNwZWNpZnlpbmcgbWFrZXMgaXQgZGVmYXVsdCB0byBcInJhbmRvbSBjaW5lbWF0aWNcIlxuICAvLyAgICAgIGNob2ljZXMpIHNvIG5vIHNpbXBsaWZpY2F0aW9uIGlzIGFwcGxpZWQsIG9ubHkgdGhlIG5lZ2F0aXZlXG4gIC8vICAgICAgYWRkaXRpb24gYWJvdmUuXG4gIGNvbnN0IG5lZ2F0aXZlUHJvbXB0ID0gJ2JsdXJyeSwgc29mdCBmb2N1cywgZmxpY2tlcmluZywgdW5zdGFibGUgbW90aW9uLCB3YXJwZWQgdGV4dCwgZ2FyYmxlZCB0ZXh0LCBkaXN0b3J0ZWQgbG9nbywgZXh0cmEgbGltYnMsIGRlZm9ybWVkIGhhbmRzLCBsb3cgZGV0YWlsLCBsb3cgcXVhbGl0eSwgYXJ0aWZhY3RzLCB3YXRlcm1hcmsnO1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXF1ZXN0KCd2aWRlbycsIGpvYklkLCB7XG4gICAgbW9kZWw6IHByb2Nlc3MuZW52LkdQVV9WSURFT19NT0RFTCA/PyAnd2FuMi4yLXRpMnYtNWInLCBwcm9tcHQsIG5lZ2F0aXZlUHJvbXB0LCBhc3BlY3RSYXRpbyxcbiAgICBkdXJhdGlvblNlY29uZHM6IDgsIHJlZmVyZW5jZXM6IGVuY29kZWRSZWZlcmVuY2VzKHJlZmVyZW5jZXMsIDMpLFxuICB9LCBzaG91bGRDYW5jZWwpO1xuICBjb25zdCBkaXIgPSBwYXRoLmpvaW4oQVNTRVRTX0RJUiwgam9iSWQpO1xuICBhd2FpdCBmcy5ta2RpcihkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBjb25zdCByYXcgPSBwYXRoLmpvaW4oZGlyLCBgZ3B1LSR7c2NlbmVJbmRleH0tcmF3Lm1wNGApO1xuICBhd2FpdCBmcy53cml0ZUZpbGUocmF3LCBhd2FpdCBieXRlcyhyZXN1bHQpKTtcbiAgY29uc3Qgb3V0cHV0ID0gcGF0aC5qb2luKGRpciwgYGdwdS0ke3NjZW5lSW5kZXh9Lm1wNGApO1xuICBhd2FpdCBzaGFycGVuR3B1Q2xpcChyYXcsIG91dHB1dCk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbi8qKlxuICogU21hbGwgKDVCLXBhcmFtZXRlcikgb3BlbiB2aWRlbyBtb2RlbHMgbGlrZSB3YW4yLjItdGkydi01YiBjb21tb25seSByZW5kZXJcbiAqIG5vdGljZWFibHkgc29mdGVyL2JsdXJyaWVyIGRldGFpbCB0aGFuIGxhcmdlciBjb21tZXJjaWFsIG1vZGVscyAoVmVvKSBcdTIwMTRcbiAqIHRoaXMgaXMgYSBrbm93biwgZG9jdW1lbnRlZCBjaGFyYWN0ZXJpc3RpYywgbm90IGEgYnVnIGluIHRoaXMgYXBwJ3NcbiAqIHJlcXVlc3QuIEEgbWlsZCB1bnNoYXJwIG1hc2sgbWVhbmluZ2Z1bGx5IGltcHJvdmVzIHBlcmNlaXZlZCBzaGFycG5lc3NcbiAqIHdpdGhvdXQgaW50cm9kdWNpbmcgaGFsbyBhcnRpZmFjdHMgb3Igb3RoZXJ3aXNlIGFsdGVyaW5nIGNvbnRlbnQsIGFuZCBpc1xuICogYXBwbGllZCBvbmx5IHRvIEdQVS1zb3VyY2VkIGNsaXBzIFx1MjAxNCBHZW1pbmkvVmVvIG91dHB1dCBhbHJlYWR5IGhhcyBlbm91Z2hcbiAqIGluaGVyZW50IGRldGFpbCB0aGF0IHRoaXMgd291bGQgb25seSBsb29rIGFydGlmaWNpYWwgdGhlcmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaGFycGVuR3B1Q2xpcChpbnB1dDogc3RyaW5nLCBvdXRwdXQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGF3YWl0IGV4ZWNGaWxlQXN5bmMoJ2ZmbXBlZycsIFtcbiAgICAgICcteScsICctaGlkZV9iYW5uZXInLCAnLWxvZ2xldmVsJywgJ2Vycm9yJywgJy1pJywgaW5wdXQsXG4gICAgICAnLXZmJywgJ3Vuc2hhcnA9NTo1OjAuNjo1OjU6MC4wJyxcbiAgICAgICctYzp2JywgJ2xpYngyNjQnLCAnLXByZXNldCcsICdmYXN0JywgJy1jcmYnLCAnMTgnLCAnLXBpeF9mbXQnLCAneXV2NDIwcCcsXG4gICAgICAnLWM6YScsICdjb3B5JyxcbiAgICAgIG91dHB1dCxcbiAgICBdLCB7IHRpbWVvdXQ6IDUgKiA2MF8wMDAsIG1heEJ1ZmZlcjogOCAqIDEwMjQgKiAxMDI0IH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIElmIHNoYXJwZW5pbmcgZmFpbHMgZm9yIGFueSByZWFzb24gKHVuZXhwZWN0ZWQgY29kZWMsIGNvcnJ1cHQgaW5wdXQpLFxuICAgIC8vIGZhbGwgYmFjayB0byB0aGUgb3JpZ2luYWwgY2xpcCB1bnRvdWNoZWQgcmF0aGVyIHRoYW4gbG9zaW5nIHRoZSBzY2VuZS5cbiAgICBjb25zb2xlLndhcm4oYFtncHUtdmlkZW9dIHNoYXJwZW5pbmcgZmFpbGVkLCB1c2luZyBvcmlnaW5hbCBjbGlwOiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gKTtcbiAgICBhd2FpdCBmcy5jb3B5RmlsZShpbnB1dCwgb3V0cHV0KTtcbiAgfVxufVxuIiwgImltcG9ydCB7IHF1ZXJ5IH0gZnJvbSAnLi9wb29sLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBDb3N0RXZlbnQge1xuICBqb2JJZDogc3RyaW5nO1xuICBwcm92aWRlcjogc3RyaW5nO1xuICBtb2RlbDogc3RyaW5nO1xuICBvcGVyYXRpb246IHN0cmluZztcbiAgcXVhbnRpdHk6IG51bWJlcjtcbiAgdW5pdDogc3RyaW5nO1xuICB1bml0Q29zdFVzZDogbnVtYmVyO1xuICBtZXRhZGF0YT86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG4vKipcbiAqIFJlY29yZHMgYW4gaXRlbWl6ZWQgcHJvdmlkZXIgZXhwZW5zZSBhbmQgdXBkYXRlcyB0aGUgam9iIHRvdGFsIHRvZ2V0aGVyLlxuICogQ29zdCB0cmFja2luZyBpcyBpbnRlbnRpb25hbGx5IGJlc3QtZWZmb3J0IHNvIGEgdGVtcG9yYXJ5IGFuYWx5dGljcy10YWJsZVxuICogaXNzdWUgY2FuIG5ldmVyIHR1cm4gYSBzdWNjZXNzZnVsIGN1c3RvbWVyIGdlbmVyYXRpb24gaW50byBhIGZhaWxlZCBqb2IuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWNvcmRHZW5lcmF0aW9uQ29zdChldmVudDogQ29zdEV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHF1YW50aXR5ID0gTWF0aC5tYXgoMCwgTnVtYmVyKGV2ZW50LnF1YW50aXR5KSB8fCAwKTtcbiAgY29uc3QgdW5pdENvc3QgPSBNYXRoLm1heCgwLCBOdW1iZXIoZXZlbnQudW5pdENvc3RVc2QpIHx8IDApO1xuICBjb25zdCB0b3RhbCA9IHF1YW50aXR5ICogdW5pdENvc3Q7XG4gIGF3YWl0IHF1ZXJ5KFxuICAgIGBXSVRIIGluc2VydGVkIEFTIChcbiAgICAgICBJTlNFUlQgSU5UTyBnZW5lcmF0aW9uX2Nvc3RfZXZlbnRzXG4gICAgICAgICAoam9iX2lkLHByb3ZpZGVyLG1vZGVsLG9wZXJhdGlvbixxdWFudGl0eSx1bml0LHVuaXRfY29zdF91c2QsdG90YWxfY29zdF91c2QsbWV0YWRhdGEpXG4gICAgICAgVkFMVUVTICgkMSwkMiwkMywkNCwkNSwkNiwkNywkOCwkOSlcbiAgICAgICBSRVRVUk5JTkcgdG90YWxfY29zdF91c2RcbiAgICAgKVxuICAgICBVUERBVEUgam9icyBTRVQgZ2VuZXJhdGlvbl9wcm92aWRlcj0kMixcbiAgICAgICBnZW5lcmF0aW9uX2Nvc3RfdXNkPUNPQUxFU0NFKGdlbmVyYXRpb25fY29zdF91c2QsMCkrKFNFTEVDVCB0b3RhbF9jb3N0X3VzZCBGUk9NIGluc2VydGVkKSxcbiAgICAgICB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQxYCxcbiAgICBbZXZlbnQuam9iSWQsIGAke2V2ZW50LnByb3ZpZGVyfToke2V2ZW50Lm1vZGVsfWAsIGV2ZW50Lm1vZGVsLCBldmVudC5vcGVyYXRpb24sIHF1YW50aXR5LCBldmVudC51bml0LCB1bml0Q29zdCwgdG90YWwsIGV2ZW50Lm1ldGFkYXRhID8gSlNPTi5zdHJpbmdpZnkoZXZlbnQubWV0YWRhdGEpIDogbnVsbF0sXG4gICkuY2F0Y2goKGVycm9yKSA9PiBjb25zb2xlLndhcm4oYFtjb3N0c10gY291bGQgbm90IHJlY29yZCAke2V2ZW50Lm9wZXJhdGlvbn06ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWApKTtcbn1cblxuZXhwb3J0IGNvbnN0IEdFTUlOSV9DT1NUX0NBVEFMT0cgPSB7XG4gIHRleHQ6IHtcbiAgICBpbnB1dFRva2VuOiBOdW1iZXIocHJvY2Vzcy5lbnYuR0VNSU5JX1RFWFRfSU5QVVRfQ09TVF9QRVJfTUlMTElPTl9VU0QgPz8gMC41MCkgLyAxXzAwMF8wMDAsXG4gICAgb3V0cHV0VG9rZW46IE51bWJlcihwcm9jZXNzLmVudi5HRU1JTklfVEVYVF9PVVRQVVRfQ09TVF9QRVJfTUlMTElPTl9VU0QgPz8gMy4wMCkgLyAxXzAwMF8wMDAsXG4gIH0sXG4gIHZpZGVvOiB7XG4gICAgbGl0ZTcyMDogMC4wNSxcbiAgICBsaXRlMTA4MDogMC4wOCxcbiAgICBmYXN0NzIwOiAwLjEwLFxuICAgIGZhc3QxMDgwOiAwLjEyLFxuICAgIGZhc3Q0azogMC4zMCxcbiAgICBzdGFuZGFyZDEwODA6IDAuNDAsXG4gICAgc3RhbmRhcmQ0azogMC42MCxcbiAgfSxcbiAgaW1hZ2U6IHsgdHdvSzogMC4xMDEsIGZvdXJLOiAwLjE1MSB9LFxuICB0dHNBdWRpb1NlY29uZDogMC4wMDA1LFxufSBhcyBjb25zdDtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlY29yZEdlbWluaVRleHRVc2FnZShqb2JJZDogc3RyaW5nLCBtb2RlbDogc3RyaW5nLCBvcGVyYXRpb246IHN0cmluZywgdXNhZ2U6IHsgcHJvbXB0VG9rZW5Db3VudD86IG51bWJlciB8IG51bGw7IGNhbmRpZGF0ZXNUb2tlbkNvdW50PzogbnVtYmVyIHwgbnVsbCB9IHwgbnVsbCB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBpbnB1dFRva2VucyA9IE1hdGgubWF4KDAsIE51bWJlcih1c2FnZT8ucHJvbXB0VG9rZW5Db3VudCA/PyAwKSk7XG4gIGNvbnN0IG91dHB1dFRva2VucyA9IE1hdGgubWF4KDAsIE51bWJlcih1c2FnZT8uY2FuZGlkYXRlc1Rva2VuQ291bnQgPz8gMCkpO1xuICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgaW5wdXRUb2tlbnMgPyByZWNvcmRHZW5lcmF0aW9uQ29zdCh7IGpvYklkLCBwcm92aWRlcjogJ2dlbWluaScsIG1vZGVsLCBvcGVyYXRpb246IGAke29wZXJhdGlvbn1faW5wdXRgLCBxdWFudGl0eTogaW5wdXRUb2tlbnMsIHVuaXQ6ICd0b2tlbicsIHVuaXRDb3N0VXNkOiBHRU1JTklfQ09TVF9DQVRBTE9HLnRleHQuaW5wdXRUb2tlbiB9KSA6IFByb21pc2UucmVzb2x2ZSgpLFxuICAgIG91dHB1dFRva2VucyA/IHJlY29yZEdlbmVyYXRpb25Db3N0KHsgam9iSWQsIHByb3ZpZGVyOiAnZ2VtaW5pJywgbW9kZWwsIG9wZXJhdGlvbjogYCR7b3BlcmF0aW9ufV9vdXRwdXRgLCBxdWFudGl0eTogb3V0cHV0VG9rZW5zLCB1bml0OiAndG9rZW4nLCB1bml0Q29zdFVzZDogR0VNSU5JX0NPU1RfQ0FUQUxPRy50ZXh0Lm91dHB1dFRva2VuIH0pIDogUHJvbWlzZS5yZXNvbHZlKCksXG4gIF0pO1xufVxuIiwgImltcG9ydCB7IFJvdXRlciB9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IHsgeiB9IGZyb20gJ3pvZCc7XG5pbXBvcnQgeyByZXF1aXJlQXV0aCB9IGZyb20gJy4uL2xpYi9hdXRoLmpzJztcbmltcG9ydCB7IHF1ZXJ5IH0gZnJvbSAnLi4vbGliL3Bvb2wuanMnO1xuaW1wb3J0IHsgQXBwRXJyb3IsIHNlbmRFcnJvciB9IGZyb20gJy4uL2xpYi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgZ3JhbnRDcmVkaXRzT25jZSB9IGZyb20gJy4uL2xpYi9iaWxsaW5nLmpzJztcblxuY29uc3Qgcm91dGVyID0gUm91dGVyKCk7XG5cbi8qKlxuICogTWlycm9ycyB0aGUgUFJPRFVDVFMgbWFwIGluIHJvdXRlcy9zdHJpcGUudHMgZXhhY3RseSBcdTIwMTQgc2FtZSBwbGFuIG5hbWVzLFxuICogc2FtZSBjcmVkaXQgYW1vdW50cywgc2FtZSBVU0QgcHJpY2VzIGFscmVhZHkgc2hvd24gb24gdGhlIHByaWNpbmcgcGFnZSBcdTIwMTRcbiAqIHNvIFBheVBhbCBpcyBhIGdlbnVpbmUgYWx0ZXJuYXRpdmUgcGF5bWVudCBtZXRob2QgZm9yIHRoZSBleGFjdCBzYW1lXG4gKiBjYXRhbG9nLCBub3QgYSBzZXBhcmF0ZSBwYXJhbGxlbCBwcm9kdWN0IGxpbmUuXG4gKlxuICogT25lLXRpbWUgcHVyY2hhc2VzIChtb2RlOiAncGF5bWVudCcpIHVzZSBQYXlQYWwncyBPcmRlcnMgdjIgQVBJIGRpcmVjdGx5XG4gKiB3aXRoIHRoZSBhbW91bnQgc3BlY2lmaWVkIHBlci1yZXF1ZXN0IFx1MjAxNCBubyBwcmUtY3JlYXRlZCBcInByaWNlXCIgb2JqZWN0IGlzXG4gKiBuZWVkZWQsIHVubGlrZSBTdHJpcGUuIFN1YnNjcmlwdGlvbnMgKG1vZGU6ICdzdWJzY3JpcHRpb24nKSBETyByZXF1aXJlIGFcbiAqIFBsYW4gdG8gZXhpc3QgaW4geW91ciBQYXlQYWwgYWNjb3VudCBmaXJzdCAoU3Vic2NyaXB0aW9ucyBBUEkgcGxhbnMgYXJlXG4gKiBjcmVhdGVkIG9uY2UsIG5vdCBwZXItY2hlY2tvdXQpIFx1MjAxNCBzZWUgdGhlIGVudiB2YXIgY29tbWVudHMgYmVsb3cgZm9yIGhvd1xuICogdG8gZ2V0IHRob3NlIHBsYW4gSURzLlxuICovXG5leHBvcnQgY29uc3QgUFJPRFVDVFMgPSB7XG4gIGNyZWF0b3I6IHsgZW52OiAnUEFZUEFMX1BMQU5fQ1JFQVRPUicsIG1vZGU6ICdzdWJzY3JpcHRpb24nLCBjcmVkaXRzOiAxNTAsIHBsYW46ICdjcmVhdG9yJywgYW1vdW50VXNkOiAzOSB9LFxuICBwcm86IHsgZW52OiAnUEFZUEFMX1BMQU5fUFJPJywgbW9kZTogJ3N1YnNjcmlwdGlvbicsIGNyZWRpdHM6IDQwMCwgcGxhbjogJ3BybycsIGFtb3VudFVzZDogOTkgfSxcbiAgYWdlbmN5OiB7IGVudjogJ1BBWVBBTF9QTEFOX0FHRU5DWScsIG1vZGU6ICdzdWJzY3JpcHRpb24nLCBjcmVkaXRzOiAxMDAwLCBwbGFuOiAnYWdlbmN5JywgYW1vdW50VXNkOiAyNDkgfSxcbiAgc2luZ2xlODogeyBtb2RlOiAncGF5bWVudCcsIGNyZWRpdHM6IDE0LCBwbGFuOiAnY3JlYXRvcicsIGFtb3VudFVzZDogMi45OSB9LFxuICBzaW5nbGUzMDogeyBtb2RlOiAncGF5bWVudCcsIGNyZWRpdHM6IDMwLCBwbGFuOiAnY3JlYXRvcicsIGFtb3VudFVzZDogNy45OSB9LFxuICBzaW5nbGU2MDogeyBtb2RlOiAncGF5bWVudCcsIGNyZWRpdHM6IDYyLCBwbGFuOiAnY3JlYXRvcicsIGFtb3VudFVzZDogMTcuOTkgfSxcbiAgdG9wdXAxMDA6IHsgbW9kZTogJ3BheW1lbnQnLCBjcmVkaXRzOiAxMDAsIHBsYW46ICdjcmVhdG9yJywgYW1vdW50VXNkOiAyNSB9LFxufSBhcyBjb25zdDtcbnR5cGUgUHJvZHVjdElkID0ga2V5b2YgdHlwZW9mIFBST0RVQ1RTO1xuXG5mdW5jdGlvbiBwYXlwYWxCYXNlKCkge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuUEFZUEFMX0VOViA9PT0gJ2xpdmUnID8gJ2h0dHBzOi8vYXBpLW0ucGF5cGFsLmNvbScgOiAnaHR0cHM6Ly9hcGktbS5zYW5kYm94LnBheXBhbC5jb20nO1xufVxuXG5mdW5jdGlvbiBhcHBVcmwoKSB7XG4gIHJldHVybiAocHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBQX1VSTCA/PyAnaHR0cDovLzEyNy4wLjAuMTozMDAxJykucmVwbGFjZSgvXFwvJC8sICcnKTtcbn1cblxuZnVuY3Rpb24gY3JlZGVudGlhbHNDb25maWd1cmVkKCkge1xuICByZXR1cm4gQm9vbGVhbihwcm9jZXNzLmVudi5QQVlQQUxfQ0xJRU5UX0lEICYmIHByb2Nlc3MuZW52LlBBWVBBTF9DTElFTlRfU0VDUkVUKTtcbn1cblxubGV0IGNhY2hlZFRva2VuOiB7IHZhbHVlOiBzdHJpbmc7IGV4cGlyZXNBdDogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcblxuLyoqIE9BdXRoMiBjbGllbnQtY3JlZGVudGlhbHMgZmxvdyBcdTIwMTQgUGF5UGFsIGFjY2VzcyB0b2tlbnMgYXJlIHNob3J0LWxpdmVkICh+OWgpIGFuZCBjYWNoZWQgaW4tcHJvY2VzcyByYXRoZXIgdGhhbiBmZXRjaGVkIHBlci1yZXF1ZXN0LiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QWNjZXNzVG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgaWYgKCFjcmVkZW50aWFsc0NvbmZpZ3VyZWQoKSkgdGhyb3cgbmV3IEFwcEVycm9yKCdCaWxsaW5nIGlzIG5vdCBjb25maWd1cmVkIHlldC4nLCA1MDMsICdCSUxMSU5HX05PVF9DT05GSUdVUkVEJyk7XG4gIGlmIChjYWNoZWRUb2tlbiAmJiBjYWNoZWRUb2tlbi5leHBpcmVzQXQgPiBEYXRlLm5vdygpICsgMzBfMDAwKSByZXR1cm4gY2FjaGVkVG9rZW4udmFsdWU7XG4gIGNvbnN0IGJhc2ljID0gQnVmZmVyLmZyb20oYCR7cHJvY2Vzcy5lbnYuUEFZUEFMX0NMSUVOVF9JRH06JHtwcm9jZXNzLmVudi5QQVlQQUxfQ0xJRU5UX1NFQ1JFVH1gKS50b1N0cmluZygnYmFzZTY0Jyk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke3BheXBhbEJhc2UoKX0vdjEvb2F1dGgyL3Rva2VuYCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHsgYXV0aG9yaXphdGlvbjogYEJhc2ljICR7YmFzaWN9YCwgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnIH0sXG4gICAgYm9keTogJ2dyYW50X3R5cGU9Y2xpZW50X2NyZWRlbnRpYWxzJyxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgQXBwRXJyb3IoJ0NvdWxkIG5vdCBhdXRoZW50aWNhdGUgd2l0aCBQYXlQYWwuJywgNTAyLCAnUEFZUEFMX0FVVEhfRkFJTEVEJyk7XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpIGFzIHsgYWNjZXNzX3Rva2VuOiBzdHJpbmc7IGV4cGlyZXNfaW46IG51bWJlciB9O1xuICBjYWNoZWRUb2tlbiA9IHsgdmFsdWU6IGRhdGEuYWNjZXNzX3Rva2VuLCBleHBpcmVzQXQ6IERhdGUubm93KCkgKyBkYXRhLmV4cGlyZXNfaW4gKiAxMDAwIH07XG4gIHJldHVybiBkYXRhLmFjY2Vzc190b2tlbjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcGF5cGFsRmV0Y2gocGF0aDogc3RyaW5nLCBpbml0OiB7IG1ldGhvZDogc3RyaW5nOyBib2R5PzogdW5rbm93bjsgaWRlbXBvdGVuY3lLZXk/OiBzdHJpbmcgfSkge1xuICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEFjY2Vzc1Rva2VuKCk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke3BheXBhbEJhc2UoKX0ke3BhdGh9YCwge1xuICAgIG1ldGhvZDogaW5pdC5tZXRob2QsXG4gICAgaGVhZGVyczoge1xuICAgICAgYXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAsXG4gICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgLi4uKGluaXQuaWRlbXBvdGVuY3lLZXkgPyB7ICdQYXlQYWwtUmVxdWVzdC1JZCc6IGluaXQuaWRlbXBvdGVuY3lLZXkgfSA6IHt9KSxcbiAgICB9LFxuICAgIGJvZHk6IGluaXQuYm9keSA/IEpTT04uc3RyaW5naWZ5KGluaXQuYm9keSkgOiB1bmRlZmluZWQsXG4gIH0pO1xuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgaWYgKCFyZXMub2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdbcGF5cGFsXSBBUEkgZXJyb3InLCByZXMuc3RhdHVzLCBKU09OLnN0cmluZ2lmeShkYXRhKS5zbGljZSgwLCA1MDApKTtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoJ1BheVBhbCBjb3VsZCBub3QgcHJvY2VzcyB0aGlzIHJlcXVlc3QuJywgNTAyLCAnUEFZUEFMX1JFUVVFU1RfRkFJTEVEJyk7XG4gIH1cbiAgcmV0dXJuIGRhdGEgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHByb3ZlTGluayhsaW5rczogdW5rbm93bik6IHN0cmluZyB8IG51bGwge1xuICBpZiAoIUFycmF5LmlzQXJyYXkobGlua3MpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgZm91bmQgPSBsaW5rcy5maW5kKChsKSA9PiBsICYmIHR5cGVvZiBsID09PSAnb2JqZWN0JyAmJiAoKGwgYXMgeyByZWw/OiBzdHJpbmcgfSkucmVsID09PSAnYXBwcm92ZScgfHwgKGwgYXMgeyByZWw/OiBzdHJpbmcgfSkucmVsID09PSAncGF5ZXItYWN0aW9uJykpO1xuICByZXR1cm4gKGZvdW5kIGFzIHsgaHJlZj86IHN0cmluZyB9IHwgdW5kZWZpbmVkKT8uaHJlZiA/PyBudWxsO1xufVxuXG5yb3V0ZXIucG9zdCgnL2NoZWNrb3V0JywgcmVxdWlyZUF1dGgsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5rZXlzKFBST0RVQ1RTKSBhcyBbUHJvZHVjdElkLCAuLi5Qcm9kdWN0SWRbXV07XG4gICAgY29uc3QgeyBwbGFuLCBqb2JJZCB9ID0gei5vYmplY3QoeyBwbGFuOiB6LmVudW0oaWRzKSwgam9iSWQ6IHouc3RyaW5nKCkudXVpZCgpLm9wdGlvbmFsKCkgfSkucGFyc2UocmVxLmJvZHkpO1xuICAgIGNvbnN0IHByb2R1Y3QgPSBQUk9EVUNUU1twbGFuXTtcblxuICAgIGlmIChwcm9kdWN0Lm1vZGUgPT09ICdzdWJzY3JpcHRpb24nKSB7XG4gICAgICBjb25zdCBwbGFuSWQgPSBwcm9jZXNzLmVudlsocHJvZHVjdCBhcyB0eXBlb2YgUFJPRFVDVFNbJ2NyZWF0b3InXSkuZW52XTtcbiAgICAgIGlmICghcGxhbklkKSB0aHJvdyBuZXcgQXBwRXJyb3IoYFBheVBhbCBwbGFuICR7KHByb2R1Y3QgYXMgdHlwZW9mIFBST0RVQ1RTWydjcmVhdG9yJ10pLmVudn0gaXMgbm90IGNvbmZpZ3VyZWQuYCwgNTAzLCAnUFJJQ0VfTk9UX0NPTkZJR1VSRUQnKTtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBwYXlwYWxGZXRjaCgnL3YxL2JpbGxpbmcvc3Vic2NyaXB0aW9ucycsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGlkZW1wb3RlbmN5S2V5OiBgc3ViLSR7cmVxLnVzZXIhLmlkfS0ke3BsYW59LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBib2R5OiB7XG4gICAgICAgICAgcGxhbl9pZDogcGxhbklkLFxuICAgICAgICAgIGN1c3RvbV9pZDogcmVxLnVzZXIhLmlkLFxuICAgICAgICAgIHN1YnNjcmliZXI6IHsgZW1haWxfYWRkcmVzczogcmVxLnVzZXIhLmVtYWlsIH0sXG4gICAgICAgICAgYXBwbGljYXRpb25fY29udGV4dDoge1xuICAgICAgICAgICAgYnJhbmRfbmFtZTogJ0FpV2ViVmlkZW8nLFxuICAgICAgICAgICAgcmV0dXJuX3VybDogYCR7YXBwVXJsKCl9L2Rhc2hib2FyZD9jaGVja291dD1zdWNjZXNzJnByb3ZpZGVyPXBheXBhbCR7am9iSWQgPyBgJmpvYj0ke2VuY29kZVVSSUNvbXBvbmVudChqb2JJZCl9YCA6ICcnfWAsXG4gICAgICAgICAgICBjYW5jZWxfdXJsOiBgJHthcHBVcmwoKX0vcHJpY2luZz9jaGVja291dD1jYW5jZWxsZWRgLFxuICAgICAgICAgICAgdXNlcl9hY3Rpb246ICdTVUJTQ1JJQkVfTk9XJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCB1cmwgPSBhcHByb3ZlTGluayhkYXRhLmxpbmtzKTtcbiAgICAgIGlmICghdXJsKSB0aHJvdyBuZXcgQXBwRXJyb3IoJ1BheVBhbCBkaWQgbm90IHJldHVybiBhbiBhcHByb3ZhbCBVUkwuJywgNTAyLCAnQ0hFQ0tPVVRfRkFJTEVEJyk7XG4gICAgICByZXMuanNvbih7IGNoZWNrb3V0VXJsOiB1cmwgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT25lLXRpbWUgcHVyY2hhc2UgXHUyMDE0IE9yZGVycyB2MiBBUEksIGFtb3VudCBzcGVjaWZpZWQgZGlyZWN0bHkuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHBheXBhbEZldGNoKCcvdjIvY2hlY2tvdXQvb3JkZXJzJywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBpZGVtcG90ZW5jeUtleTogYG9yZGVyLSR7cmVxLnVzZXIhLmlkfS0ke3BsYW59LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgYm9keToge1xuICAgICAgICBpbnRlbnQ6ICdDQVBUVVJFJyxcbiAgICAgICAgcHVyY2hhc2VfdW5pdHM6IFt7XG4gICAgICAgICAgY3VzdG9tX2lkOiByZXEudXNlciEuaWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGBBaVdlYlZpZGVvIFx1MjAxNCAke3BsYW59YCxcbiAgICAgICAgICBhbW91bnQ6IHsgY3VycmVuY3lfY29kZTogJ1VTRCcsIHZhbHVlOiBwcm9kdWN0LmFtb3VudFVzZC50b0ZpeGVkKDIpIH0sXG4gICAgICAgIH1dLFxuICAgICAgICBwYXltZW50X3NvdXJjZToge1xuICAgICAgICAgIHBheXBhbDoge1xuICAgICAgICAgICAgZXhwZXJpZW5jZV9jb250ZXh0OiB7XG4gICAgICAgICAgICAgIGJyYW5kX25hbWU6ICdBaVdlYlZpZGVvJyxcbiAgICAgICAgICAgICAgdXNlcl9hY3Rpb246ICdQQVlfTk9XJyxcbiAgICAgICAgICAgICAgcmV0dXJuX3VybDogYCR7YXBwVXJsKCl9L2FwaS9wYXlwYWwvcmV0dXJuP3BsYW49JHtwbGFufSZ1c2VySWQ9JHtyZXEudXNlciEuaWR9JHtqb2JJZCA/IGAmam9iPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGpvYklkKX1gIDogJyd9YCxcbiAgICAgICAgICAgICAgY2FuY2VsX3VybDogYCR7YXBwVXJsKCl9L3ByaWNpbmc/Y2hlY2tvdXQ9Y2FuY2VsbGVkYCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgdXJsID0gYXBwcm92ZUxpbmsoZGF0YS5saW5rcyk7XG4gICAgaWYgKCF1cmwpIHRocm93IG5ldyBBcHBFcnJvcignUGF5UGFsIGRpZCBub3QgcmV0dXJuIGFuIGFwcHJvdmFsIFVSTC4nLCA1MDIsICdDSEVDS09VVF9GQUlMRUQnKTtcbiAgICAvLyBUcmFjayB3aGljaCBwcm9kdWN0IHRoaXMgb3JkZXIgaWQgbWFwcyB0byBcdTIwMTQgdGhlIHJldHVybiBoYW5kbGVyIGFuZCB0aGVcbiAgICAvLyB3ZWJob29rIGJvdGggbmVlZCB0aGlzLCBhbmQgUGF5UGFsJ3Mgb3duIG9yZGVyIG9iamVjdCBkb2Vzbid0IHJldGFpblxuICAgIC8vIGN1c3RvbSBsaW5lLWl0ZW0gbWV0YWRhdGEgdGhlIHdheSBTdHJpcGUncyBzZXNzaW9uIG1ldGFkYXRhIGRvZXMuXG4gICAgYXdhaXQgcXVlcnkoXG4gICAgICBgSU5TRVJUIElOVE8gcGF5bWVudHMgKHVzZXJfaWQsIHByb3ZpZGVyLCBwcm92aWRlcl9yZWYsIGtpbmQsIGFtb3VudF91c2QsIGNyZWRpdHNfZ3JhbnRlZCwgcGxhbiwgc3RhdHVzKVxuICAgICAgIFZBTFVFUyAoJDEsJ3BheXBhbCcsJDIsJ29uZV90aW1lJywkMywkNCwkNSwncGVuZGluZycpYCxcbiAgICAgIFtyZXEudXNlciEuaWQsIGRhdGEuaWQsIHByb2R1Y3QuYW1vdW50VXNkLCBwcm9kdWN0LmNyZWRpdHMsIHByb2R1Y3QucGxhbl1cbiAgICApO1xuICAgIHJlcy5qc29uKHsgY2hlY2tvdXRVcmw6IHVybCB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7IHNlbmRFcnJvcihyZXMsIGVycik7IH1cbn0pO1xuXG4vKipcbiAqIEJ1eWVyIGxhbmRzIGhlcmUgYWZ0ZXIgYXBwcm92aW5nIHBheW1lbnQgb24gUGF5UGFsLiBUaGlzIGNhbGwgdG8gQ0FQVFVSRVxuICogdGhlIG9yZGVyIGlzIHdoYXQgYWN0dWFsbHkgY29tcGxldGVzIHRoZSBwYXltZW50IFx1MjAxNCBPcmRlcnMgdjIgcmVxdWlyZXMgYW5cbiAqIGV4cGxpY2l0IGNhcHR1cmUgc3RlcCBhZnRlciBhcHByb3ZhbCwgaXQgZG9lcyBub3QgaGFwcGVuIGF1dG9tYXRpY2FsbHkuXG4gKiBDcmVkaXRzIGFyZSBncmFudGVkIGhlcmUgQU5EIGlkZW1wb3RlbnRseSByZS1jb25maXJtZWQgYnkgdGhlXG4gKiBQQVlNRU5ULkNBUFRVUkUuQ09NUExFVEVEIHdlYmhvb2sgYmVsb3csIHNvIGEgcGF5bWVudCBpcyBuZXZlciBsb3N0IGlmIHRoZVxuICogYnV5ZXIgY2xvc2VzIHRoZSB0YWIgcmlnaHQgYWZ0ZXIgYXBwcm92aW5nIGJ1dCBiZWZvcmUgdGhpcyByZWRpcmVjdFxuICogZmluaXNoZXMgbG9hZGluZy5cbiAqL1xucm91dGVyLmdldCgnL3JldHVybicsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICBjb25zdCBvcmRlcklkID0gU3RyaW5nKHJlcS5xdWVyeS50b2tlbiA/PyAnJyk7XG4gIGNvbnN0IGpvYklkID0gdHlwZW9mIHJlcS5xdWVyeS5qb2IgPT09ICdzdHJpbmcnICYmIC9eWzAtOWEtZi1dezM2fSQvaS50ZXN0KHJlcS5xdWVyeS5qb2IpID8gcmVxLnF1ZXJ5LmpvYiA6ICcnO1xuICBjb25zdCByZWRpcmVjdEZhaWwgPSBgJHthcHBVcmwoKX0vcHJpY2luZz9jaGVja291dD1mYWlsZWRgO1xuICBpZiAoIW9yZGVySWQpIHsgcmVzLnJlZGlyZWN0KHJlZGlyZWN0RmFpbCk7IHJldHVybjsgfVxuICB0cnkge1xuICAgIGNvbnN0IGNhcHR1cmUgPSBhd2FpdCBwYXlwYWxGZXRjaChgL3YyL2NoZWNrb3V0L29yZGVycy8ke29yZGVySWR9L2NhcHR1cmVgLCB7IG1ldGhvZDogJ1BPU1QnLCBpZGVtcG90ZW5jeUtleTogYGNhcHR1cmUtJHtvcmRlcklkfWAgfSk7XG4gICAgaWYgKGNhcHR1cmUuc3RhdHVzICE9PSAnQ09NUExFVEVEJykgeyByZXMucmVkaXJlY3QocmVkaXJlY3RGYWlsKTsgcmV0dXJuOyB9XG4gICAgYXdhaXQgZ3JhbnRPbmVUaW1lUGF5bWVudChvcmRlcklkKTtcbiAgICByZXMucmVkaXJlY3QoYCR7YXBwVXJsKCl9L2Rhc2hib2FyZD9jaGVja291dD1zdWNjZXNzJnByb3ZpZGVyPXBheXBhbCR7am9iSWQgPyBgJmpvYj0ke2VuY29kZVVSSUNvbXBvbmVudChqb2JJZCl9YCA6ICcnfWApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbcGF5cGFsXSByZXR1cm4vY2FwdHVyZSBlcnJvcicsIChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgIHJlcy5yZWRpcmVjdChyZWRpcmVjdEZhaWwpO1xuICB9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gZ3JhbnRPbmVUaW1lUGF5bWVudChvcmRlcklkOiBzdHJpbmcpIHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTx7IHVzZXJfaWQ6IHN0cmluZzsgY3JlZGl0c19ncmFudGVkOiBudW1iZXI7IHBsYW46IHN0cmluZzsgc3RhdHVzOiBzdHJpbmcgfT4oXG4gICAgJ1NFTEVDVCB1c2VyX2lkLCBjcmVkaXRzX2dyYW50ZWQsIHBsYW4sIHN0YXR1cyBGUk9NIHBheW1lbnRzIFdIRVJFIHByb3ZpZGVyPSQxIEFORCBwcm92aWRlcl9yZWY9JDInLCBbJ3BheXBhbCcsIG9yZGVySWRdXG4gICk7XG4gIGNvbnN0IHBheW1lbnQgPSByb3dzWzBdO1xuICBpZiAoIXBheW1lbnQgfHwgcGF5bWVudC5zdGF0dXMgPT09ICdwYWlkJykgcmV0dXJuOyAvLyBhbHJlYWR5IGdyYW50ZWQsIG9yIHdlIGRvbid0IHJlY29nbml6ZSB0aGlzIG9yZGVyXG4gIGF3YWl0IGdyYW50Q3JlZGl0c09uY2UoeyBrZXk6IGBwYXlwYWw6b3JkZXI6JHtvcmRlcklkfWAsIHVzZXJJZDogcGF5bWVudC51c2VyX2lkLCBjcmVkaXRzOiBwYXltZW50LmNyZWRpdHNfZ3JhbnRlZCwgcmVhc29uOiBgUGF5UGFsIHB1cmNoYXNlICR7b3JkZXJJZH1gIH0pO1xuICBhd2FpdCBxdWVyeShgVVBEQVRFIHBheW1lbnRzIFNFVCBzdGF0dXM9J3BhaWQnIFdIRVJFIHByb3ZpZGVyPSdwYXlwYWwnIEFORCBwcm92aWRlcl9yZWY9JDFgLCBbb3JkZXJJZF0pO1xufVxuXG4vKiogQ2FuY2VscyBhIHN1YnNjcmlwdGlvbiBhdCBQYXlQYWwncyBlbmQuIFRyaWdnZXJlZCBmcm9tIHRoZSBiaWxsaW5nIHBhZ2UncyBvd24gYXV0by1yZW5ldyB0b2dnbGUgcmF0aGVyIHRoYW4gYW4gZXh0ZXJuYWwgcG9ydGFsIFx1MjAxNCBQYXlQYWwgaGFzIG5vIFN0cmlwZS1zdHlsZSBob3N0ZWQgYmlsbGluZyBwb3J0YWwuICovXG5yb3V0ZXIucG9zdCgnL3N1YnNjcmlwdGlvbnMvOmlkL2NhbmNlbCcsIHJlcXVpcmVBdXRoLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PHsgcGF5cGFsX3N1YnNjcmlwdGlvbl9pZDogc3RyaW5nIH0+KFxuICAgICAgJ1NFTEVDVCBwYXlwYWxfc3Vic2NyaXB0aW9uX2lkIEZST00gc3Vic2NyaXB0aW9ucyBXSEVSRSBpZD0kMSBBTkQgdXNlcl9pZD0kMicsIFtyZXEucGFyYW1zLmlkLCByZXEudXNlciEuaWRdXG4gICAgKTtcbiAgICBjb25zdCBzdWJzY3JpcHRpb25JZCA9IHJvd3NbMF0/LnBheXBhbF9zdWJzY3JpcHRpb25faWQ7XG4gICAgaWYgKCFzdWJzY3JpcHRpb25JZCkgdGhyb3cgbmV3IEFwcEVycm9yKCdTdWJzY3JpcHRpb24gbm90IGZvdW5kLicsIDQwNCwgJ05PVF9GT1VORCcpO1xuICAgIGF3YWl0IHBheXBhbEZldGNoKGAvdjEvYmlsbGluZy9zdWJzY3JpcHRpb25zLyR7c3Vic2NyaXB0aW9uSWR9L2NhbmNlbGAsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keTogeyByZWFzb246ICdDYW5jZWxsZWQgYnkgY3VzdG9tZXInIH0sXG4gICAgfSkuY2F0Y2goKCkgPT4ge30pOyAvLyBQYXlQYWwgcmV0dXJucyAyMDQgd2l0aCBubyBib2R5IG9uIHN1Y2Nlc3M7IHRyZWF0IGFueSB0aHJvd24gcGFyc2UgZXJyb3IgYXMgc3VjY2Vzc1xuICAgIGF3YWl0IHF1ZXJ5KGBVUERBVEUgc3Vic2NyaXB0aW9ucyBTRVQgYXV0b19yZW5ldz1mYWxzZSwgc3RhdHVzPSdjYW5jZWxsZWQnLCB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQxYCwgW3JlcS5wYXJhbXMuaWRdKTtcbiAgICByZXMuanNvbih7IG9rOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlcnIpIHsgc2VuZEVycm9yKHJlcywgZXJyKTsgfVxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIG9uY2UoZXZlbnRJZDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFByb21pc2U8dm9pZD4pIHtcbiAgY29uc3QgeyByb3dDb3VudCB9ID0gYXdhaXQgcXVlcnkoJ0lOU0VSVCBJTlRPIHBheXBhbF9ldmVudHMgKGV2ZW50X2lkKSBWQUxVRVMgKCQxKSBPTiBDT05GTElDVCBETyBOT1RISU5HIFJFVFVSTklORyBldmVudF9pZCcsIFtldmVudElkXSk7XG4gIGlmICghcm93Q291bnQpIHJldHVybjtcbiAgdHJ5IHsgYXdhaXQgYWN0aW9uKCk7IH1cbiAgY2F0Y2ggKGVycikge1xuICAgIGF3YWl0IHF1ZXJ5KCdERUxFVEUgRlJPTSBwYXlwYWxfZXZlbnRzIFdIRVJFIGV2ZW50X2lkPSQxJywgW2V2ZW50SWRdKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG5cbi8qKlxuICogVmVyaWZpZXMgdGhlIHdlYmhvb2sgY2FtZSBmcm9tIFBheVBhbCB1c2luZyBQYXlQYWwncyBvd24gcG9zdGJhY2tcbiAqIHZlcmlmaWNhdGlvbiBlbmRwb2ludCwgcmF0aGVyIHRoYW4gaGFuZC1yb2xsaW5nIHRoZSBzaWduYXR1cmUvY2VydGlmaWNhdGVcbiAqIGNoZWNrIFx1MjAxNCB0aGlzIGlzIHRoZSBvZmZpY2lhbGx5IGRvY3VtZW50ZWQgc2ltcGxlciBhbHRlcm5hdGl2ZSwgYW5kIGF2b2lkc1xuICogYSBzdWJ0bGUgaG9tZS1ncm93biBjcnlwdG8gYnVnIGluIGEgcGF5bWVudC1zZWN1cml0eS1jcml0aWNhbCBwYXRoLlxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlXZWJob29rU2lnbmF0dXJlKGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBib2R5OiB1bmtub3duKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IHdlYmhvb2tJZCA9IHByb2Nlc3MuZW52LlBBWVBBTF9XRUJIT09LX0lEO1xuICBpZiAoIXdlYmhvb2tJZCkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwYXlwYWxGZXRjaCgnL3YxL25vdGlmaWNhdGlvbnMvdmVyaWZ5LXdlYmhvb2stc2lnbmF0dXJlJywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IHtcbiAgICAgIHRyYW5zbWlzc2lvbl9pZDogaGVhZGVyc1sncGF5cGFsLXRyYW5zbWlzc2lvbi1pZCddLFxuICAgICAgdHJhbnNtaXNzaW9uX3RpbWU6IGhlYWRlcnNbJ3BheXBhbC10cmFuc21pc3Npb24tdGltZSddLFxuICAgICAgY2VydF91cmw6IGhlYWRlcnNbJ3BheXBhbC1jZXJ0LXVybCddLFxuICAgICAgYXV0aF9hbGdvOiBoZWFkZXJzWydwYXlwYWwtYXV0aC1hbGdvJ10sXG4gICAgICB0cmFuc21pc3Npb25fc2lnOiBoZWFkZXJzWydwYXlwYWwtdHJhbnNtaXNzaW9uLXNpZyddLFxuICAgICAgd2ViaG9va19pZDogd2ViaG9va0lkLFxuICAgICAgd2ViaG9va19ldmVudDogYm9keSxcbiAgICB9LFxuICB9KTtcbiAgcmV0dXJuIHJlc3VsdC52ZXJpZmljYXRpb25fc3RhdHVzID09PSAnU1VDQ0VTUyc7XG59XG5cbnJvdXRlci5wb3N0KCcvd2ViaG9vaycsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGlmICghcHJvY2Vzcy5lbnYuUEFZUEFMX1dFQkhPT0tfSUQpIHRocm93IG5ldyBBcHBFcnJvcignUGF5UGFsIHdlYmhvb2sgaXMgbm90IGNvbmZpZ3VyZWQuJywgNTAzLCAnV0VCSE9PS19OT1RfQ09ORklHVVJFRCcpO1xuICAgIGNvbnN0IGV2ZW50ID0gcmVxLmJvZHkgYXMgeyBpZDogc3RyaW5nOyBldmVudF90eXBlOiBzdHJpbmc7IHJlc291cmNlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB9O1xuICAgIGNvbnN0IHZlcmlmaWVkID0gYXdhaXQgdmVyaWZ5V2ViaG9va1NpZ25hdHVyZShyZXEuaGVhZGVycyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgZXZlbnQpLmNhdGNoKCgpID0+IGZhbHNlKTtcbiAgICBpZiAoIXZlcmlmaWVkKSB0aHJvdyBuZXcgQXBwRXJyb3IoJ0ludmFsaWQgUGF5UGFsIHdlYmhvb2sgc2lnbmF0dXJlLicsIDQwMCwgJ0lOVkFMSURfU0lHTkFUVVJFJyk7XG5cbiAgICBhd2FpdCBvbmNlKGV2ZW50LmlkLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBPbmUtdGltZSBwYXltZW50IGNvbmZpcm1lZC4gVGhpcyBpcyB0aGUgYXV0aG9yaXRhdGl2ZSBwYXRoIGlmIHRoZVxuICAgICAgLy8gYnV5ZXIgY2xvc2VkIHRoZSB0YWIgYmVmb3JlIHRoZSAvcmV0dXJuIHJlZGlyZWN0J3MgY2FwdHVyZSBjYWxsXG4gICAgICAvLyBjb3VsZCBmaW5pc2ggXHUyMDE0IGdyYW50T25lVGltZVBheW1lbnQoKSBpcyBpZGVtcG90ZW50IGVpdGhlciB3YXkuXG4gICAgICBpZiAoZXZlbnQuZXZlbnRfdHlwZSA9PT0gJ1BBWU1FTlQuQ0FQVFVSRS5DT01QTEVURUQnKSB7XG4gICAgICAgIGNvbnN0IG9yZGVySWQgPSAoZXZlbnQucmVzb3VyY2UgYXMgeyBzdXBwbGVtZW50YXJ5X2RhdGE/OiB7IHJlbGF0ZWRfaWRzPzogeyBvcmRlcl9pZD86IHN0cmluZyB9IH0gfSlcbiAgICAgICAgICAuc3VwcGxlbWVudGFyeV9kYXRhPy5yZWxhdGVkX2lkcz8ub3JkZXJfaWQ7XG4gICAgICAgIGlmIChvcmRlcklkKSBhd2FpdCBncmFudE9uZVRpbWVQYXltZW50KG9yZGVySWQpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXZlbnQuZXZlbnRfdHlwZSA9PT0gJ0JJTExJTkcuU1VCU0NSSVBUSU9OLkFDVElWQVRFRCcpIHtcbiAgICAgICAgY29uc3QgcmVzb3VyY2UgPSBldmVudC5yZXNvdXJjZSBhcyB7IGlkOiBzdHJpbmc7IGN1c3RvbV9pZD86IHN0cmluZzsgcGxhbl9pZD86IHN0cmluZyB9O1xuICAgICAgICBjb25zdCB1c2VySWQgPSByZXNvdXJjZS5jdXN0b21faWQ7XG4gICAgICAgIGlmICghdXNlcklkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IG1hdGNoZWQgPSAoT2JqZWN0LmVudHJpZXMoUFJPRFVDVFMpIGFzIEFycmF5PFtQcm9kdWN0SWQsIHR5cGVvZiBQUk9EVUNUU1tQcm9kdWN0SWRdXT4pXG4gICAgICAgICAgLmZpbmQoKFssIHBdKSA9PiBwLm1vZGUgPT09ICdzdWJzY3JpcHRpb24nICYmIHByb2Nlc3MuZW52WyhwIGFzIHR5cGVvZiBQUk9EVUNUU1snY3JlYXRvciddKS5lbnZdID09PSByZXNvdXJjZS5wbGFuX2lkKTtcbiAgICAgICAgaWYgKCFtYXRjaGVkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IFssIHByb2R1Y3RdID0gbWF0Y2hlZDtcbiAgICAgICAgYXdhaXQgcXVlcnkoYElOU0VSVCBJTlRPIHN1YnNjcmlwdGlvbnMgKHVzZXJfaWQsIHBheXBhbF9zdWJzY3JpcHRpb25faWQsIHBsYW4sIHN0YXR1cywgdXBkYXRlZF9hdClcbiAgICAgICAgICBWQUxVRVMgKCQxLCQyLCQzLCdhY3RpdmUnLE5PVygpKSBPTiBDT05GTElDVCAocGF5cGFsX3N1YnNjcmlwdGlvbl9pZClcbiAgICAgICAgICBETyBVUERBVEUgU0VUIHBsYW49RVhDTFVERUQucGxhbixzdGF0dXM9J2FjdGl2ZScsdXBkYXRlZF9hdD1OT1coKWAsIFt1c2VySWQsIHJlc291cmNlLmlkLCBwcm9kdWN0LnBsYW5dKTtcbiAgICAgICAgLy8gQ3JlZGl0cyBhcmUgZ3JhbnRlZCBmcm9tIFBBWU1FTlQuU0FMRS5DT01QTEVURUQgYmVsb3csIHdoaWNoIHByb3Zlc1xuICAgICAgICAvLyBtb25leSB3YXMgY29sbGVjdGVkLiBBY3RpdmF0aW9uIGFsb25lIG11c3Qgbm90IGdyYW50IG9yIGRvdWJsZS1ncmFudC5cbiAgICAgIH1cblxuICAgICAgLy8gUmVjdXJyaW5nIHJlbmV3YWwgcGF5bWVudCBmb3IgYW4gZXhpc3Rpbmcgc3Vic2NyaXB0aW9uLlxuICAgICAgaWYgKGV2ZW50LmV2ZW50X3R5cGUgPT09ICdQQVlNRU5ULlNBTEUuQ09NUExFVEVEJykge1xuICAgICAgICBjb25zdCByZXNvdXJjZSA9IGV2ZW50LnJlc291cmNlIGFzIHsgaWQ6IHN0cmluZzsgYmlsbGluZ19hZ3JlZW1lbnRfaWQ/OiBzdHJpbmc7IGFtb3VudD86IHsgdG90YWw/OiBzdHJpbmcgfSB9O1xuICAgICAgICBjb25zdCBzdWJzY3JpcHRpb25JZCA9IHJlc291cmNlLmJpbGxpbmdfYWdyZWVtZW50X2lkO1xuICAgICAgICBpZiAoIXN1YnNjcmlwdGlvbklkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8eyB1c2VyX2lkOiBzdHJpbmc7IHBsYW46IHN0cmluZyB9PihcbiAgICAgICAgICAnU0VMRUNUIHVzZXJfaWQsIHBsYW4gRlJPTSBzdWJzY3JpcHRpb25zIFdIRVJFIHBheXBhbF9zdWJzY3JpcHRpb25faWQ9JDEnLCBbc3Vic2NyaXB0aW9uSWRdXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHN1YiA9IHJvd3NbMF07XG4gICAgICAgIGlmICghc3ViKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHByb2R1Y3QgPSBPYmplY3QudmFsdWVzKFBST0RVQ1RTKS5maW5kKChwKSA9PiBwLm1vZGUgPT09ICdzdWJzY3JpcHRpb24nICYmIHAucGxhbiA9PT0gc3ViLnBsYW4pO1xuICAgICAgICBpZiAoIXByb2R1Y3QpIHJldHVybjtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdQYXltZW50cyA9IGF3YWl0IHF1ZXJ5PHsgY291bnQ6IG51bWJlciB9PihgU0VMRUNUIENPVU5UKCopOjppbnQgY291bnQgRlJPTSBwYXltZW50cyBXSEVSRSBwcm92aWRlcj0ncGF5cGFsJyBBTkQgdXNlcl9pZD0kMSBBTkQgcGxhbj0kMiBBTkQga2luZCBMSUtFICdzdWJzY3JpcHRpb25fJScgQU5EIHN0YXR1cz0ncGFpZCdgLCBbc3ViLnVzZXJfaWQsIHN1Yi5wbGFuXSk7XG4gICAgICAgIGNvbnN0IGtpbmQgPSAoZXhpc3RpbmdQYXltZW50cy5yb3dzWzBdPy5jb3VudCA/PyAwKSA9PT0gMCA/ICdzdWJzY3JpcHRpb25faW5pdGlhbCcgOiAnc3Vic2NyaXB0aW9uX3JlbmV3YWwnO1xuICAgICAgICBhd2FpdCBncmFudENyZWRpdHNPbmNlKHsga2V5OiBgcGF5cGFsOnNhbGU6JHtyZXNvdXJjZS5pZH1gLCB1c2VySWQ6IHN1Yi51c2VyX2lkLCBjcmVkaXRzOiBwcm9kdWN0LmNyZWRpdHMsIHBsYW46IHN1Yi5wbGFuLCByZWFzb246IGBQYXlQYWwgc3Vic2NyaXB0aW9uIHBheW1lbnQgJHtyZXNvdXJjZS5pZH1gIH0pO1xuICAgICAgICBhd2FpdCBxdWVyeShcbiAgICAgICAgICBgSU5TRVJUIElOVE8gcGF5bWVudHMgKHVzZXJfaWQsIHByb3ZpZGVyLCBwcm92aWRlcl9yZWYsIGtpbmQsIGFtb3VudF91c2QsIGNyZWRpdHNfZ3JhbnRlZCwgcGxhbiwgc3RhdHVzKVxuICAgICAgICAgICBWQUxVRVMgKCQxLCdwYXlwYWwnLCQyLCQzLCQ0LCQ1LCQ2LCdwYWlkJykgT04gQ09ORkxJQ1QgKHByb3ZpZGVyLCBwcm92aWRlcl9yZWYpIERPIE5PVEhJTkdgLFxuICAgICAgICAgIFtzdWIudXNlcl9pZCwgcmVzb3VyY2UuaWQsIGtpbmQsIE51bWJlcihyZXNvdXJjZS5hbW91bnQ/LnRvdGFsID8/IHByb2R1Y3QuYW1vdW50VXNkKSwgcHJvZHVjdC5jcmVkaXRzLCBzdWIucGxhbl1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGV2ZW50LmV2ZW50X3R5cGUgPT09ICdCSUxMSU5HLlNVQlNDUklQVElPTi5DQU5DRUxMRUQnIHx8IGV2ZW50LmV2ZW50X3R5cGUgPT09ICdCSUxMSU5HLlNVQlNDUklQVElPTi5FWFBJUkVEJyB8fCBldmVudC5ldmVudF90eXBlID09PSAnQklMTElORy5TVUJTQ1JJUFRJT04uU1VTUEVOREVEJykge1xuICAgICAgICBjb25zdCByZXNvdXJjZSA9IGV2ZW50LnJlc291cmNlIGFzIHsgaWQ6IHN0cmluZyB9O1xuICAgICAgICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PHsgdXNlcl9pZDogc3RyaW5nIH0+KCdTRUxFQ1QgdXNlcl9pZCBGUk9NIHN1YnNjcmlwdGlvbnMgV0hFUkUgcGF5cGFsX3N1YnNjcmlwdGlvbl9pZD0kMScsIFtyZXNvdXJjZS5pZF0pO1xuICAgICAgICBpZiAocm93c1swXSkgYXdhaXQgcXVlcnkoXCJVUERBVEUgdXNlcnMgU0VUIHBsYW49J2ZyZWUnLCB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQxXCIsIFtyb3dzWzBdLnVzZXJfaWRdKTtcbiAgICAgICAgYXdhaXQgcXVlcnkoXCJVUERBVEUgc3Vic2NyaXB0aW9ucyBTRVQgc3RhdHVzPSdjYW5jZWxsZWQnLCBhdXRvX3JlbmV3PWZhbHNlLCB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIHBheXBhbF9zdWJzY3JpcHRpb25faWQ9JDFcIiwgW3Jlc291cmNlLmlkXSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmVzLmpzb24oeyByZWNlaXZlZDogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7IHNlbmRFcnJvcihyZXMsIGVycik7IH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCByb3V0ZXI7XG4iLCAiZXhwb3J0ICogZnJvbSBcIi4vZXJyb3JzLmpzXCI7XG5leHBvcnQgKiBmcm9tIFwiLi9oZWxwZXJzL3BhcnNlVXRpbC5qc1wiO1xuZXhwb3J0ICogZnJvbSBcIi4vaGVscGVycy90eXBlQWxpYXNlcy5qc1wiO1xuZXhwb3J0ICogZnJvbSBcIi4vaGVscGVycy91dGlsLmpzXCI7XG5leHBvcnQgKiBmcm9tIFwiLi90eXBlcy5qc1wiO1xuZXhwb3J0ICogZnJvbSBcIi4vWm9kRXJyb3IuanNcIjtcbiIsICJleHBvcnQgdmFyIHV0aWw7XG4oZnVuY3Rpb24gKHV0aWwpIHtcbiAgICB1dGlsLmFzc2VydEVxdWFsID0gKF8pID0+IHsgfTtcbiAgICBmdW5jdGlvbiBhc3NlcnRJcyhfYXJnKSB7IH1cbiAgICB1dGlsLmFzc2VydElzID0gYXNzZXJ0SXM7XG4gICAgZnVuY3Rpb24gYXNzZXJ0TmV2ZXIoX3gpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgfVxuICAgIHV0aWwuYXNzZXJ0TmV2ZXIgPSBhc3NlcnROZXZlcjtcbiAgICB1dGlsLmFycmF5VG9FbnVtID0gKGl0ZW1zKSA9PiB7XG4gICAgICAgIGNvbnN0IG9iaiA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgICAgIG9ialtpdGVtXSA9IGl0ZW07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9O1xuICAgIHV0aWwuZ2V0VmFsaWRFbnVtVmFsdWVzID0gKG9iaikgPT4ge1xuICAgICAgICBjb25zdCB2YWxpZEtleXMgPSB1dGlsLm9iamVjdEtleXMob2JqKS5maWx0ZXIoKGspID0+IHR5cGVvZiBvYmpbb2JqW2tdXSAhPT0gXCJudW1iZXJcIik7XG4gICAgICAgIGNvbnN0IGZpbHRlcmVkID0ge307XG4gICAgICAgIGZvciAoY29uc3QgayBvZiB2YWxpZEtleXMpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkW2tdID0gb2JqW2tdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1dGlsLm9iamVjdFZhbHVlcyhmaWx0ZXJlZCk7XG4gICAgfTtcbiAgICB1dGlsLm9iamVjdFZhbHVlcyA9IChvYmopID0+IHtcbiAgICAgICAgcmV0dXJuIHV0aWwub2JqZWN0S2V5cyhvYmopLm1hcChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIG9ialtlXTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICB1dGlsLm9iamVjdEtleXMgPSB0eXBlb2YgT2JqZWN0LmtleXMgPT09IFwiZnVuY3Rpb25cIiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGJhbi9iYW5cbiAgICAgICAgPyAob2JqKSA9PiBPYmplY3Qua2V5cyhvYmopIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgYmFuL2JhblxuICAgICAgICA6IChvYmplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBrZXlzO1xuICAgICAgICB9O1xuICAgIHV0aWwuZmluZCA9IChhcnIsIGNoZWNrZXIpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGFycikge1xuICAgICAgICAgICAgaWYgKGNoZWNrZXIoaXRlbSkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIHV0aWwuaXNJbnRlZ2VyID0gdHlwZW9mIE51bWJlci5pc0ludGVnZXIgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/ICh2YWwpID0+IE51bWJlci5pc0ludGVnZXIodmFsKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGJhbi9iYW5cbiAgICAgICAgOiAodmFsKSA9PiB0eXBlb2YgdmFsID09PSBcIm51bWJlclwiICYmIE51bWJlci5pc0Zpbml0ZSh2YWwpICYmIE1hdGguZmxvb3IodmFsKSA9PT0gdmFsO1xuICAgIGZ1bmN0aW9uIGpvaW5WYWx1ZXMoYXJyYXksIHNlcGFyYXRvciA9IFwiIHwgXCIpIHtcbiAgICAgICAgcmV0dXJuIGFycmF5Lm1hcCgodmFsKSA9PiAodHlwZW9mIHZhbCA9PT0gXCJzdHJpbmdcIiA/IGAnJHt2YWx9J2AgOiB2YWwpKS5qb2luKHNlcGFyYXRvcik7XG4gICAgfVxuICAgIHV0aWwuam9pblZhbHVlcyA9IGpvaW5WYWx1ZXM7XG4gICAgdXRpbC5qc29uU3RyaW5naWZ5UmVwbGFjZXIgPSAoXywgdmFsdWUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJiaWdpbnRcIikge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG59KSh1dGlsIHx8ICh1dGlsID0ge30pKTtcbmV4cG9ydCB2YXIgb2JqZWN0VXRpbDtcbihmdW5jdGlvbiAob2JqZWN0VXRpbCkge1xuICAgIG9iamVjdFV0aWwubWVyZ2VTaGFwZXMgPSAoZmlyc3QsIHNlY29uZCkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uZmlyc3QsXG4gICAgICAgICAgICAuLi5zZWNvbmQsIC8vIHNlY29uZCBvdmVyd3JpdGVzIGZpcnN0XG4gICAgICAgIH07XG4gICAgfTtcbn0pKG9iamVjdFV0aWwgfHwgKG9iamVjdFV0aWwgPSB7fSkpO1xuZXhwb3J0IGNvbnN0IFpvZFBhcnNlZFR5cGUgPSB1dGlsLmFycmF5VG9FbnVtKFtcbiAgICBcInN0cmluZ1wiLFxuICAgIFwibmFuXCIsXG4gICAgXCJudW1iZXJcIixcbiAgICBcImludGVnZXJcIixcbiAgICBcImZsb2F0XCIsXG4gICAgXCJib29sZWFuXCIsXG4gICAgXCJkYXRlXCIsXG4gICAgXCJiaWdpbnRcIixcbiAgICBcInN5bWJvbFwiLFxuICAgIFwiZnVuY3Rpb25cIixcbiAgICBcInVuZGVmaW5lZFwiLFxuICAgIFwibnVsbFwiLFxuICAgIFwiYXJyYXlcIixcbiAgICBcIm9iamVjdFwiLFxuICAgIFwidW5rbm93blwiLFxuICAgIFwicHJvbWlzZVwiLFxuICAgIFwidm9pZFwiLFxuICAgIFwibmV2ZXJcIixcbiAgICBcIm1hcFwiLFxuICAgIFwic2V0XCIsXG5dKTtcbmV4cG9ydCBjb25zdCBnZXRQYXJzZWRUeXBlID0gKGRhdGEpID0+IHtcbiAgICBjb25zdCB0ID0gdHlwZW9mIGRhdGE7XG4gICAgc3dpdGNoICh0KSB7XG4gICAgICAgIGNhc2UgXCJ1bmRlZmluZWRcIjpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLnVuZGVmaW5lZDtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUuc3RyaW5nO1xuICAgICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyLmlzTmFOKGRhdGEpID8gWm9kUGFyc2VkVHlwZS5uYW4gOiBab2RQYXJzZWRUeXBlLm51bWJlcjtcbiAgICAgICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLmJvb2xlYW47XG4gICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUuZnVuY3Rpb247XG4gICAgICAgIGNhc2UgXCJiaWdpbnRcIjpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLmJpZ2ludDtcbiAgICAgICAgY2FzZSBcInN5bWJvbFwiOlxuICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUuc3ltYm9sO1xuICAgICAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLmFycmF5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS5udWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEudGhlbiAmJiB0eXBlb2YgZGF0YS50aGVuID09PSBcImZ1bmN0aW9uXCIgJiYgZGF0YS5jYXRjaCAmJiB0eXBlb2YgZGF0YS5jYXRjaCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUucHJvbWlzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgTWFwICE9PSBcInVuZGVmaW5lZFwiICYmIGRhdGEgaW5zdGFuY2VvZiBNYXApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gWm9kUGFyc2VkVHlwZS5tYXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIFNldCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkYXRhIGluc3RhbmNlb2YgU2V0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUuc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiBEYXRlICE9PSBcInVuZGVmaW5lZFwiICYmIGRhdGEgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFpvZFBhcnNlZFR5cGUuZGF0ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLm9iamVjdDtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBab2RQYXJzZWRUeXBlLnVua25vd247XG4gICAgfVxufTtcbiIsICJpbXBvcnQgeyB1dGlsIH0gZnJvbSBcIi4vaGVscGVycy91dGlsLmpzXCI7XG5leHBvcnQgY29uc3QgWm9kSXNzdWVDb2RlID0gdXRpbC5hcnJheVRvRW51bShbXG4gICAgXCJpbnZhbGlkX3R5cGVcIixcbiAgICBcImludmFsaWRfbGl0ZXJhbFwiLFxuICAgIFwiY3VzdG9tXCIsXG4gICAgXCJpbnZhbGlkX3VuaW9uXCIsXG4gICAgXCJpbnZhbGlkX3VuaW9uX2Rpc2NyaW1pbmF0b3JcIixcbiAgICBcImludmFsaWRfZW51bV92YWx1ZVwiLFxuICAgIFwidW5yZWNvZ25pemVkX2tleXNcIixcbiAgICBcImludmFsaWRfYXJndW1lbnRzXCIsXG4gICAgXCJpbnZhbGlkX3JldHVybl90eXBlXCIsXG4gICAgXCJpbnZhbGlkX2RhdGVcIixcbiAgICBcImludmFsaWRfc3RyaW5nXCIsXG4gICAgXCJ0b29fc21hbGxcIixcbiAgICBcInRvb19iaWdcIixcbiAgICBcImludmFsaWRfaW50ZXJzZWN0aW9uX3R5cGVzXCIsXG4gICAgXCJub3RfbXVsdGlwbGVfb2ZcIixcbiAgICBcIm5vdF9maW5pdGVcIixcbl0pO1xuZXhwb3J0IGNvbnN0IHF1b3RlbGVzc0pzb24gPSAob2JqKSA9PiB7XG4gICAgY29uc3QganNvbiA9IEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgMik7XG4gICAgcmV0dXJuIGpzb24ucmVwbGFjZSgvXCIoW15cIl0rKVwiOi9nLCBcIiQxOlwiKTtcbn07XG5leHBvcnQgY2xhc3MgWm9kRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gICAgZ2V0IGVycm9ycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNzdWVzO1xuICAgIH1cbiAgICBjb25zdHJ1Y3Rvcihpc3N1ZXMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5pc3N1ZXMgPSBbXTtcbiAgICAgICAgdGhpcy5hZGRJc3N1ZSA9IChzdWIpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaXNzdWVzID0gWy4uLnRoaXMuaXNzdWVzLCBzdWJdO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmFkZElzc3VlcyA9IChzdWJzID0gW10pID0+IHtcbiAgICAgICAgICAgIHRoaXMuaXNzdWVzID0gWy4uLnRoaXMuaXNzdWVzLCAuLi5zdWJzXTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgYWN0dWFsUHJvdG8gPSBuZXcudGFyZ2V0LnByb3RvdHlwZTtcbiAgICAgICAgaWYgKE9iamVjdC5zZXRQcm90b3R5cGVPZikge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGJhbi9iYW5cbiAgICAgICAgICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZih0aGlzLCBhY3R1YWxQcm90byk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9fcHJvdG9fXyA9IGFjdHVhbFByb3RvO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubmFtZSA9IFwiWm9kRXJyb3JcIjtcbiAgICAgICAgdGhpcy5pc3N1ZXMgPSBpc3N1ZXM7XG4gICAgfVxuICAgIGZvcm1hdChfbWFwcGVyKSB7XG4gICAgICAgIGNvbnN0IG1hcHBlciA9IF9tYXBwZXIgfHxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChpc3N1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpc3N1ZS5tZXNzYWdlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZmllbGRFcnJvcnMgPSB7IF9lcnJvcnM6IFtdIH07XG4gICAgICAgIGNvbnN0IHByb2Nlc3NFcnJvciA9IChlcnJvcikgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBpc3N1ZSBvZiBlcnJvci5pc3N1ZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNzdWUuY29kZSA9PT0gXCJpbnZhbGlkX3VuaW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNzdWUudW5pb25FcnJvcnMubWFwKHByb2Nlc3NFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGlzc3VlLmNvZGUgPT09IFwiaW52YWxpZF9yZXR1cm5fdHlwZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3NFcnJvcihpc3N1ZS5yZXR1cm5UeXBlRXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS5jb2RlID09PSBcImludmFsaWRfYXJndW1lbnRzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc0Vycm9yKGlzc3VlLmFyZ3VtZW50c0Vycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUucGF0aC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZmllbGRFcnJvcnMuX2Vycm9ycy5wdXNoKG1hcHBlcihpc3N1ZSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnIgPSBmaWVsZEVycm9ycztcbiAgICAgICAgICAgICAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGlzc3VlLnBhdGgubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbCA9IGlzc3VlLnBhdGhbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXJtaW5hbCA9IGkgPT09IGlzc3VlLnBhdGgubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGVybWluYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyW2VsXSA9IGN1cnJbZWxdIHx8IHsgX2Vycm9yczogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiAodHlwZW9mIGVsID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICBjdXJyW2VsXSA9IGN1cnJbZWxdIHx8IHsgX2Vycm9yczogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB9IGVsc2UgaWYgKHR5cGVvZiBlbCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgY29uc3QgZXJyb3JBcnJheTogYW55ID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICBlcnJvckFycmF5Ll9lcnJvcnMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgIGN1cnJbZWxdID0gY3VycltlbF0gfHwgZXJyb3JBcnJheTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyW2VsXSA9IGN1cnJbZWxdIHx8IHsgX2Vycm9yczogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyW2VsXS5fZXJyb3JzLnB1c2gobWFwcGVyKGlzc3VlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyID0gY3VycltlbF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHByb2Nlc3NFcnJvcih0aGlzKTtcbiAgICAgICAgcmV0dXJuIGZpZWxkRXJyb3JzO1xuICAgIH1cbiAgICBzdGF0aWMgYXNzZXJ0KHZhbHVlKSB7XG4gICAgICAgIGlmICghKHZhbHVlIGluc3RhbmNlb2YgWm9kRXJyb3IpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vdCBhIFpvZEVycm9yOiAke3ZhbHVlfWApO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZXNzYWdlO1xuICAgIH1cbiAgICBnZXQgbWVzc2FnZSgpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuaXNzdWVzLCB1dGlsLmpzb25TdHJpbmdpZnlSZXBsYWNlciwgMik7XG4gICAgfVxuICAgIGdldCBpc0VtcHR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pc3N1ZXMubGVuZ3RoID09PSAwO1xuICAgIH1cbiAgICBmbGF0dGVuKG1hcHBlciA9IChpc3N1ZSkgPT4gaXNzdWUubWVzc2FnZSkge1xuICAgICAgICBjb25zdCBmaWVsZEVycm9ycyA9IHt9O1xuICAgICAgICBjb25zdCBmb3JtRXJyb3JzID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc3ViIG9mIHRoaXMuaXNzdWVzKSB7XG4gICAgICAgICAgICBpZiAoc3ViLnBhdGgubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0RWwgPSBzdWIucGF0aFswXTtcbiAgICAgICAgICAgICAgICBmaWVsZEVycm9yc1tmaXJzdEVsXSA9IGZpZWxkRXJyb3JzW2ZpcnN0RWxdIHx8IFtdO1xuICAgICAgICAgICAgICAgIGZpZWxkRXJyb3JzW2ZpcnN0RWxdLnB1c2gobWFwcGVyKHN1YikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9ybUVycm9ycy5wdXNoKG1hcHBlcihzdWIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBmb3JtRXJyb3JzLCBmaWVsZEVycm9ycyB9O1xuICAgIH1cbiAgICBnZXQgZm9ybUVycm9ycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxhdHRlbigpO1xuICAgIH1cbn1cblpvZEVycm9yLmNyZWF0ZSA9IChpc3N1ZXMpID0+IHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBab2RFcnJvcihpc3N1ZXMpO1xuICAgIHJldHVybiBlcnJvcjtcbn07XG4iLCAiaW1wb3J0IHsgWm9kSXNzdWVDb2RlIH0gZnJvbSBcIi4uL1pvZEVycm9yLmpzXCI7XG5pbXBvcnQgeyB1dGlsLCBab2RQYXJzZWRUeXBlIH0gZnJvbSBcIi4uL2hlbHBlcnMvdXRpbC5qc1wiO1xuY29uc3QgZXJyb3JNYXAgPSAoaXNzdWUsIF9jdHgpID0+IHtcbiAgICBsZXQgbWVzc2FnZTtcbiAgICBzd2l0Y2ggKGlzc3VlLmNvZGUpIHtcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlOlxuICAgICAgICAgICAgaWYgKGlzc3VlLnJlY2VpdmVkID09PSBab2RQYXJzZWRUeXBlLnVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcIlJlcXVpcmVkXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEV4cGVjdGVkICR7aXNzdWUuZXhwZWN0ZWR9LCByZWNlaXZlZCAke2lzc3VlLnJlY2VpdmVkfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUuaW52YWxpZF9saXRlcmFsOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkIGxpdGVyYWwgdmFsdWUsIGV4cGVjdGVkICR7SlNPTi5zdHJpbmdpZnkoaXNzdWUuZXhwZWN0ZWQsIHV0aWwuanNvblN0cmluZ2lmeVJlcGxhY2VyKX1gO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLnVucmVjb2duaXplZF9rZXlzOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBVbnJlY29nbml6ZWQga2V5KHMpIGluIG9iamVjdDogJHt1dGlsLmpvaW5WYWx1ZXMoaXNzdWUua2V5cywgXCIsIFwiKX1gO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfdW5pb246XG4gICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgaW5wdXRgO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfdW5pb25fZGlzY3JpbWluYXRvcjpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBkaXNjcmltaW5hdG9yIHZhbHVlLiBFeHBlY3RlZCAke3V0aWwuam9pblZhbHVlcyhpc3N1ZS5vcHRpb25zKX1gO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfZW51bV92YWx1ZTpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBlbnVtIHZhbHVlLiBFeHBlY3RlZCAke3V0aWwuam9pblZhbHVlcyhpc3N1ZS5vcHRpb25zKX0sIHJlY2VpdmVkICcke2lzc3VlLnJlY2VpdmVkfSdgO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfYXJndW1lbnRzOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkIGZ1bmN0aW9uIGFyZ3VtZW50c2A7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUuaW52YWxpZF9yZXR1cm5fdHlwZTpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBmdW5jdGlvbiByZXR1cm4gdHlwZWA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUuaW52YWxpZF9kYXRlOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnZhbGlkIGRhdGVgO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiBpc3N1ZS52YWxpZGF0aW9uID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKFwiaW5jbHVkZXNcIiBpbiBpc3N1ZS52YWxpZGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBpbnB1dDogbXVzdCBpbmNsdWRlIFwiJHtpc3N1ZS52YWxpZGF0aW9uLmluY2x1ZGVzfVwiYDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpc3N1ZS52YWxpZGF0aW9uLnBvc2l0aW9uID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gYCR7bWVzc2FnZX0gYXQgb25lIG9yIG1vcmUgcG9zaXRpb25zIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byAke2lzc3VlLnZhbGlkYXRpb24ucG9zaXRpb259YDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChcInN0YXJ0c1dpdGhcIiBpbiBpc3N1ZS52YWxpZGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgSW52YWxpZCBpbnB1dDogbXVzdCBzdGFydCB3aXRoIFwiJHtpc3N1ZS52YWxpZGF0aW9uLnN0YXJ0c1dpdGh9XCJgO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChcImVuZHNXaXRoXCIgaW4gaXNzdWUudmFsaWRhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgaW5wdXQ6IG11c3QgZW5kIHdpdGggXCIke2lzc3VlLnZhbGlkYXRpb24uZW5kc1dpdGh9XCJgO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdXRpbC5hc3NlcnROZXZlcihpc3N1ZS52YWxpZGF0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS52YWxpZGF0aW9uICE9PSBcInJlZ2V4XCIpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgJHtpc3N1ZS52YWxpZGF0aW9ufWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJJbnZhbGlkXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUudG9vX3NtYWxsOlxuICAgICAgICAgICAgaWYgKGlzc3VlLnR5cGUgPT09IFwiYXJyYXlcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYEFycmF5IG11c3QgY29udGFpbiAke2lzc3VlLmV4YWN0ID8gXCJleGFjdGx5XCIgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgYXQgbGVhc3RgIDogYG1vcmUgdGhhbmB9ICR7aXNzdWUubWluaW11bX0gZWxlbWVudChzKWA7XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS50eXBlID09PSBcInN0cmluZ1wiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgU3RyaW5nIG11c3QgY29udGFpbiAke2lzc3VlLmV4YWN0ID8gXCJleGFjdGx5XCIgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgYXQgbGVhc3RgIDogYG92ZXJgfSAke2lzc3VlLm1pbmltdW19IGNoYXJhY3RlcihzKWA7XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS50eXBlID09PSBcIm51bWJlclwiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgTnVtYmVyIG11c3QgYmUgJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5IGVxdWFsIHRvIGAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGAgOiBgZ3JlYXRlciB0aGFuIGB9JHtpc3N1ZS5taW5pbXVtfWA7XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS50eXBlID09PSBcImJpZ2ludFwiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgTnVtYmVyIG11c3QgYmUgJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5IGVxdWFsIHRvIGAgOiBpc3N1ZS5pbmNsdXNpdmUgPyBgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGAgOiBgZ3JlYXRlciB0aGFuIGB9JHtpc3N1ZS5taW5pbXVtfWA7XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS50eXBlID09PSBcImRhdGVcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYERhdGUgbXVzdCBiZSAke2lzc3VlLmV4YWN0ID8gYGV4YWN0bHkgZXF1YWwgdG8gYCA6IGlzc3VlLmluY2x1c2l2ZSA/IGBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gYCA6IGBncmVhdGVyIHRoYW4gYH0ke25ldyBEYXRlKE51bWJlcihpc3N1ZS5taW5pbXVtKSl9YDtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gXCJJbnZhbGlkIGlucHV0XCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUudG9vX2JpZzpcbiAgICAgICAgICAgIGlmIChpc3N1ZS50eXBlID09PSBcImFycmF5XCIpXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBBcnJheSBtdXN0IGNvbnRhaW4gJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5YCA6IGlzc3VlLmluY2x1c2l2ZSA/IGBhdCBtb3N0YCA6IGBsZXNzIHRoYW5gfSAke2lzc3VlLm1heGltdW19IGVsZW1lbnQocylgO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJzdHJpbmdcIilcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gYFN0cmluZyBtdXN0IGNvbnRhaW4gJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5YCA6IGlzc3VlLmluY2x1c2l2ZSA/IGBhdCBtb3N0YCA6IGB1bmRlcmB9ICR7aXNzdWUubWF4aW11bX0gY2hhcmFjdGVyKHMpYDtcbiAgICAgICAgICAgIGVsc2UgaWYgKGlzc3VlLnR5cGUgPT09IFwibnVtYmVyXCIpXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBOdW1iZXIgbXVzdCBiZSAke2lzc3VlLmV4YWN0ID8gYGV4YWN0bHlgIDogaXNzdWUuaW5jbHVzaXZlID8gYGxlc3MgdGhhbiBvciBlcXVhbCB0b2AgOiBgbGVzcyB0aGFuYH0gJHtpc3N1ZS5tYXhpbXVtfWA7XG4gICAgICAgICAgICBlbHNlIGlmIChpc3N1ZS50eXBlID09PSBcImJpZ2ludFwiKVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBgQmlnSW50IG11c3QgYmUgJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5YCA6IGlzc3VlLmluY2x1c2l2ZSA/IGBsZXNzIHRoYW4gb3IgZXF1YWwgdG9gIDogYGxlc3MgdGhhbmB9ICR7aXNzdWUubWF4aW11bX1gO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXNzdWUudHlwZSA9PT0gXCJkYXRlXCIpXG4gICAgICAgICAgICAgICAgbWVzc2FnZSA9IGBEYXRlIG11c3QgYmUgJHtpc3N1ZS5leGFjdCA/IGBleGFjdGx5YCA6IGlzc3VlLmluY2x1c2l2ZSA/IGBzbWFsbGVyIHRoYW4gb3IgZXF1YWwgdG9gIDogYHNtYWxsZXIgdGhhbmB9ICR7bmV3IERhdGUoTnVtYmVyKGlzc3VlLm1heGltdW0pKX1gO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBcIkludmFsaWQgaW5wdXRcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5jdXN0b206XG4gICAgICAgICAgICBtZXNzYWdlID0gYEludmFsaWQgaW5wdXRgO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgWm9kSXNzdWVDb2RlLmludmFsaWRfaW50ZXJzZWN0aW9uX3R5cGVzOlxuICAgICAgICAgICAgbWVzc2FnZSA9IGBJbnRlcnNlY3Rpb24gcmVzdWx0cyBjb3VsZCBub3QgYmUgbWVyZ2VkYDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFpvZElzc3VlQ29kZS5ub3RfbXVsdGlwbGVfb2Y6XG4gICAgICAgICAgICBtZXNzYWdlID0gYE51bWJlciBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgJHtpc3N1ZS5tdWx0aXBsZU9mfWA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBab2RJc3N1ZUNvZGUubm90X2Zpbml0ZTpcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBcIk51bWJlciBtdXN0IGJlIGZpbml0ZVwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBtZXNzYWdlID0gX2N0eC5kZWZhdWx0RXJyb3I7XG4gICAgICAgICAgICB1dGlsLmFzc2VydE5ldmVyKGlzc3VlKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbWVzc2FnZSB9O1xufTtcbmV4cG9ydCBkZWZhdWx0IGVycm9yTWFwO1xuIiwgImltcG9ydCBkZWZhdWx0RXJyb3JNYXAgZnJvbSBcIi4vbG9jYWxlcy9lbi5qc1wiO1xubGV0IG92ZXJyaWRlRXJyb3JNYXAgPSBkZWZhdWx0RXJyb3JNYXA7XG5leHBvcnQgeyBkZWZhdWx0RXJyb3JNYXAgfTtcbmV4cG9ydCBmdW5jdGlvbiBzZXRFcnJvck1hcChtYXApIHtcbiAgICBvdmVycmlkZUVycm9yTWFwID0gbWFwO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEVycm9yTWFwKCkge1xuICAgIHJldHVybiBvdmVycmlkZUVycm9yTWFwO1xufVxuIiwgImltcG9ydCB7IGdldEVycm9yTWFwIH0gZnJvbSBcIi4uL2Vycm9ycy5qc1wiO1xuaW1wb3J0IGRlZmF1bHRFcnJvck1hcCBmcm9tIFwiLi4vbG9jYWxlcy9lbi5qc1wiO1xuZXhwb3J0IGNvbnN0IG1ha2VJc3N1ZSA9IChwYXJhbXMpID0+IHtcbiAgICBjb25zdCB7IGRhdGEsIHBhdGgsIGVycm9yTWFwcywgaXNzdWVEYXRhIH0gPSBwYXJhbXM7XG4gICAgY29uc3QgZnVsbFBhdGggPSBbLi4ucGF0aCwgLi4uKGlzc3VlRGF0YS5wYXRoIHx8IFtdKV07XG4gICAgY29uc3QgZnVsbElzc3VlID0ge1xuICAgICAgICAuLi5pc3N1ZURhdGEsXG4gICAgICAgIHBhdGg6IGZ1bGxQYXRoLFxuICAgIH07XG4gICAgaWYgKGlzc3VlRGF0YS5tZXNzYWdlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmlzc3VlRGF0YSxcbiAgICAgICAgICAgIHBhdGg6IGZ1bGxQYXRoLFxuICAgICAgICAgICAgbWVzc2FnZTogaXNzdWVEYXRhLm1lc3NhZ2UsXG4gICAgICAgIH07XG4gICAgfVxuICAgIGxldCBlcnJvck1lc3NhZ2UgPSBcIlwiO1xuICAgIGNvbnN0IG1hcHMgPSBlcnJvck1hcHNcbiAgICAgICAgLmZpbHRlcigobSkgPT4gISFtKVxuICAgICAgICAuc2xpY2UoKVxuICAgICAgICAucmV2ZXJzZSgpO1xuICAgIGZvciAoY29uc3QgbWFwIG9mIG1hcHMpIHtcbiAgICAgICAgZXJyb3JNZXNzYWdlID0gbWFwKGZ1bGxJc3N1ZSwgeyBkYXRhLCBkZWZhdWx0RXJyb3I6IGVycm9yTWVzc2FnZSB9KS5tZXNzYWdlO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICAuLi5pc3N1ZURhdGEsXG4gICAgICAgIHBhdGg6IGZ1bGxQYXRoLFxuICAgICAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgfTtcbn07XG5leHBvcnQgY29uc3QgRU1QVFlfUEFUSCA9IFtdO1xuZXhwb3J0IGZ1bmN0aW9uIGFkZElzc3VlVG9Db250ZXh0KGN0eCwgaXNzdWVEYXRhKSB7XG4gICAgY29uc3Qgb3ZlcnJpZGVNYXAgPSBnZXRFcnJvck1hcCgpO1xuICAgIGNvbnN0IGlzc3VlID0gbWFrZUlzc3VlKHtcbiAgICAgICAgaXNzdWVEYXRhOiBpc3N1ZURhdGEsXG4gICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgZXJyb3JNYXBzOiBbXG4gICAgICAgICAgICBjdHguY29tbW9uLmNvbnRleHR1YWxFcnJvck1hcCwgLy8gY29udGV4dHVhbCBlcnJvciBtYXAgaXMgZmlyc3QgcHJpb3JpdHlcbiAgICAgICAgICAgIGN0eC5zY2hlbWFFcnJvck1hcCwgLy8gdGhlbiBzY2hlbWEtYm91bmQgbWFwIGlmIGF2YWlsYWJsZVxuICAgICAgICAgICAgb3ZlcnJpZGVNYXAsIC8vIHRoZW4gZ2xvYmFsIG92ZXJyaWRlIG1hcFxuICAgICAgICAgICAgb3ZlcnJpZGVNYXAgPT09IGRlZmF1bHRFcnJvck1hcCA/IHVuZGVmaW5lZCA6IGRlZmF1bHRFcnJvck1hcCwgLy8gdGhlbiBnbG9iYWwgZGVmYXVsdCBtYXBcbiAgICAgICAgXS5maWx0ZXIoKHgpID0+ICEheCksXG4gICAgfSk7XG4gICAgY3R4LmNvbW1vbi5pc3N1ZXMucHVzaChpc3N1ZSk7XG59XG5leHBvcnQgY2xhc3MgUGFyc2VTdGF0dXMge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLnZhbHVlID0gXCJ2YWxpZFwiO1xuICAgIH1cbiAgICBkaXJ0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMudmFsdWUgPT09IFwidmFsaWRcIilcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSBcImRpcnR5XCI7XG4gICAgfVxuICAgIGFib3J0KCkge1xuICAgICAgICBpZiAodGhpcy52YWx1ZSAhPT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gXCJhYm9ydGVkXCI7XG4gICAgfVxuICAgIHN0YXRpYyBtZXJnZUFycmF5KHN0YXR1cywgcmVzdWx0cykge1xuICAgICAgICBjb25zdCBhcnJheVZhbHVlID0gW107XG4gICAgICAgIGZvciAoY29uc3QgcyBvZiByZXN1bHRzKSB7XG4gICAgICAgICAgICBpZiAocy5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgaWYgKHMuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICBhcnJheVZhbHVlLnB1c2gocy52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiBzdGF0dXMudmFsdWUsIHZhbHVlOiBhcnJheVZhbHVlIH07XG4gICAgfVxuICAgIHN0YXRpYyBhc3luYyBtZXJnZU9iamVjdEFzeW5jKHN0YXR1cywgcGFpcnMpIHtcbiAgICAgICAgY29uc3Qgc3luY1BhaXJzID0gW107XG4gICAgICAgIGZvciAoY29uc3QgcGFpciBvZiBwYWlycykge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gYXdhaXQgcGFpci5rZXk7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHBhaXIudmFsdWU7XG4gICAgICAgICAgICBzeW5jUGFpcnMucHVzaCh7XG4gICAgICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlT2JqZWN0U3luYyhzdGF0dXMsIHN5bmNQYWlycyk7XG4gICAgfVxuICAgIHN0YXRpYyBtZXJnZU9iamVjdFN5bmMoc3RhdHVzLCBwYWlycykge1xuICAgICAgICBjb25zdCBmaW5hbE9iamVjdCA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IHBhaXIgb2YgcGFpcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHsga2V5LCB2YWx1ZSB9ID0gcGFpcjtcbiAgICAgICAgICAgIGlmIChrZXkuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgIGlmICh2YWx1ZS5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgaWYgKGtleS5zdGF0dXMgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgIGlmICh2YWx1ZS5zdGF0dXMgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgIGlmIChrZXkudmFsdWUgIT09IFwiX19wcm90b19fXCIgJiYgKHR5cGVvZiB2YWx1ZS52YWx1ZSAhPT0gXCJ1bmRlZmluZWRcIiB8fCBwYWlyLmFsd2F5c1NldCkpIHtcbiAgICAgICAgICAgICAgICBmaW5hbE9iamVjdFtrZXkudmFsdWVdID0gdmFsdWUudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiBzdGF0dXMudmFsdWUsIHZhbHVlOiBmaW5hbE9iamVjdCB9O1xuICAgIH1cbn1cbmV4cG9ydCBjb25zdCBJTlZBTElEID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgc3RhdHVzOiBcImFib3J0ZWRcIixcbn0pO1xuZXhwb3J0IGNvbnN0IERJUlRZID0gKHZhbHVlKSA9PiAoeyBzdGF0dXM6IFwiZGlydHlcIiwgdmFsdWUgfSk7XG5leHBvcnQgY29uc3QgT0sgPSAodmFsdWUpID0+ICh7IHN0YXR1czogXCJ2YWxpZFwiLCB2YWx1ZSB9KTtcbmV4cG9ydCBjb25zdCBpc0Fib3J0ZWQgPSAoeCkgPT4geC5zdGF0dXMgPT09IFwiYWJvcnRlZFwiO1xuZXhwb3J0IGNvbnN0IGlzRGlydHkgPSAoeCkgPT4geC5zdGF0dXMgPT09IFwiZGlydHlcIjtcbmV4cG9ydCBjb25zdCBpc1ZhbGlkID0gKHgpID0+IHguc3RhdHVzID09PSBcInZhbGlkXCI7XG5leHBvcnQgY29uc3QgaXNBc3luYyA9ICh4KSA9PiB0eXBlb2YgUHJvbWlzZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiB4IGluc3RhbmNlb2YgUHJvbWlzZTtcbiIsICJleHBvcnQgdmFyIGVycm9yVXRpbDtcbihmdW5jdGlvbiAoZXJyb3JVdGlsKSB7XG4gICAgZXJyb3JVdGlsLmVyclRvT2JqID0gKG1lc3NhZ2UpID0+IHR5cGVvZiBtZXNzYWdlID09PSBcInN0cmluZ1wiID8geyBtZXNzYWdlIH0gOiBtZXNzYWdlIHx8IHt9O1xuICAgIC8vIGJpb21lLWlnbm9yZSBsaW50OlxuICAgIGVycm9yVXRpbC50b1N0cmluZyA9IChtZXNzYWdlKSA9PiB0eXBlb2YgbWVzc2FnZSA9PT0gXCJzdHJpbmdcIiA/IG1lc3NhZ2UgOiBtZXNzYWdlPy5tZXNzYWdlO1xufSkoZXJyb3JVdGlsIHx8IChlcnJvclV0aWwgPSB7fSkpO1xuIiwgImltcG9ydCB7IFpvZEVycm9yLCBab2RJc3N1ZUNvZGUsIH0gZnJvbSBcIi4vWm9kRXJyb3IuanNcIjtcbmltcG9ydCB7IGRlZmF1bHRFcnJvck1hcCwgZ2V0RXJyb3JNYXAgfSBmcm9tIFwiLi9lcnJvcnMuanNcIjtcbmltcG9ydCB7IGVycm9yVXRpbCB9IGZyb20gXCIuL2hlbHBlcnMvZXJyb3JVdGlsLmpzXCI7XG5pbXBvcnQgeyBESVJUWSwgSU5WQUxJRCwgT0ssIFBhcnNlU3RhdHVzLCBhZGRJc3N1ZVRvQ29udGV4dCwgaXNBYm9ydGVkLCBpc0FzeW5jLCBpc0RpcnR5LCBpc1ZhbGlkLCBtYWtlSXNzdWUsIH0gZnJvbSBcIi4vaGVscGVycy9wYXJzZVV0aWwuanNcIjtcbmltcG9ydCB7IHV0aWwsIFpvZFBhcnNlZFR5cGUsIGdldFBhcnNlZFR5cGUgfSBmcm9tIFwiLi9oZWxwZXJzL3V0aWwuanNcIjtcbmNsYXNzIFBhcnNlSW5wdXRMYXp5UGF0aCB7XG4gICAgY29uc3RydWN0b3IocGFyZW50LCB2YWx1ZSwgcGF0aCwga2V5KSB7XG4gICAgICAgIHRoaXMuX2NhY2hlZFBhdGggPSBbXTtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuZGF0YSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9wYXRoID0gcGF0aDtcbiAgICAgICAgdGhpcy5fa2V5ID0ga2V5O1xuICAgIH1cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jYWNoZWRQYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodGhpcy5fa2V5KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlZFBhdGgucHVzaCguLi50aGlzLl9wYXRoLCAuLi50aGlzLl9rZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FjaGVkUGF0aC5wdXNoKC4uLnRoaXMuX3BhdGgsIHRoaXMuX2tleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFBhdGg7XG4gICAgfVxufVxuY29uc3QgaGFuZGxlUmVzdWx0ID0gKGN0eCwgcmVzdWx0KSA9PiB7XG4gICAgaWYgKGlzVmFsaWQocmVzdWx0KSkge1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQudmFsdWUgfTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmICghY3R4LmNvbW1vbi5pc3N1ZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJWYWxpZGF0aW9uIGZhaWxlZCBidXQgbm8gaXNzdWVzIGRldGVjdGVkLlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBnZXQgZXJyb3IoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2Vycm9yKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZXJyb3I7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgWm9kRXJyb3IoY3R4LmNvbW1vbi5pc3N1ZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Vycm9yID0gZXJyb3I7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2Vycm9yO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICB9XG59O1xuZnVuY3Rpb24gcHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpIHtcbiAgICBpZiAoIXBhcmFtcylcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIGNvbnN0IHsgZXJyb3JNYXAsIGludmFsaWRfdHlwZV9lcnJvciwgcmVxdWlyZWRfZXJyb3IsIGRlc2NyaXB0aW9uIH0gPSBwYXJhbXM7XG4gICAgaWYgKGVycm9yTWFwICYmIChpbnZhbGlkX3R5cGVfZXJyb3IgfHwgcmVxdWlyZWRfZXJyb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgdXNlIFwiaW52YWxpZF90eXBlX2Vycm9yXCIgb3IgXCJyZXF1aXJlZF9lcnJvclwiIGluIGNvbmp1bmN0aW9uIHdpdGggY3VzdG9tIGVycm9yIG1hcC5gKTtcbiAgICB9XG4gICAgaWYgKGVycm9yTWFwKVxuICAgICAgICByZXR1cm4geyBlcnJvck1hcDogZXJyb3JNYXAsIGRlc2NyaXB0aW9uIH07XG4gICAgY29uc3QgY3VzdG9tTWFwID0gKGlzcywgY3R4KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgbWVzc2FnZSB9ID0gcGFyYW1zO1xuICAgICAgICBpZiAoaXNzLmNvZGUgPT09IFwiaW52YWxpZF9lbnVtX3ZhbHVlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG1lc3NhZ2U6IG1lc3NhZ2UgPz8gY3R4LmRlZmF1bHRFcnJvciB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgY3R4LmRhdGEgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG1lc3NhZ2U6IG1lc3NhZ2UgPz8gcmVxdWlyZWRfZXJyb3IgPz8gY3R4LmRlZmF1bHRFcnJvciB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc3MuY29kZSAhPT0gXCJpbnZhbGlkX3R5cGVcIilcbiAgICAgICAgICAgIHJldHVybiB7IG1lc3NhZ2U6IGN0eC5kZWZhdWx0RXJyb3IgfTtcbiAgICAgICAgcmV0dXJuIHsgbWVzc2FnZTogbWVzc2FnZSA/PyBpbnZhbGlkX3R5cGVfZXJyb3IgPz8gY3R4LmRlZmF1bHRFcnJvciB9O1xuICAgIH07XG4gICAgcmV0dXJuIHsgZXJyb3JNYXA6IGN1c3RvbU1hcCwgZGVzY3JpcHRpb24gfTtcbn1cbmV4cG9ydCBjbGFzcyBab2RUeXBlIHtcbiAgICBnZXQgZGVzY3JpcHRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuZGVzY3JpcHRpb247XG4gICAgfVxuICAgIF9nZXRUeXBlKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBnZXRQYXJzZWRUeXBlKGlucHV0LmRhdGEpO1xuICAgIH1cbiAgICBfZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCkge1xuICAgICAgICByZXR1cm4gKGN0eCB8fCB7XG4gICAgICAgICAgICBjb21tb246IGlucHV0LnBhcmVudC5jb21tb24sXG4gICAgICAgICAgICBkYXRhOiBpbnB1dC5kYXRhLFxuICAgICAgICAgICAgcGFyc2VkVHlwZTogZ2V0UGFyc2VkVHlwZShpbnB1dC5kYXRhKSxcbiAgICAgICAgICAgIHNjaGVtYUVycm9yTWFwOiB0aGlzLl9kZWYuZXJyb3JNYXAsXG4gICAgICAgICAgICBwYXRoOiBpbnB1dC5wYXRoLFxuICAgICAgICAgICAgcGFyZW50OiBpbnB1dC5wYXJlbnQsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBfcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXM6IG5ldyBQYXJzZVN0YXR1cygpLFxuICAgICAgICAgICAgY3R4OiB7XG4gICAgICAgICAgICAgICAgY29tbW9uOiBpbnB1dC5wYXJlbnQuY29tbW9uLFxuICAgICAgICAgICAgICAgIGRhdGE6IGlucHV0LmRhdGEsXG4gICAgICAgICAgICAgICAgcGFyc2VkVHlwZTogZ2V0UGFyc2VkVHlwZShpbnB1dC5kYXRhKSxcbiAgICAgICAgICAgICAgICBzY2hlbWFFcnJvck1hcDogdGhpcy5fZGVmLmVycm9yTWFwLFxuICAgICAgICAgICAgICAgIHBhdGg6IGlucHV0LnBhdGgsXG4gICAgICAgICAgICAgICAgcGFyZW50OiBpbnB1dC5wYXJlbnQsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cbiAgICBfcGFyc2VTeW5jKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlKGlucHV0KTtcbiAgICAgICAgaWYgKGlzQXN5bmMocmVzdWx0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU3luY2hyb25vdXMgcGFyc2UgZW5jb3VudGVyZWQgcHJvbWlzZS5cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgX3BhcnNlQXN5bmMoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcGFyc2UoaW5wdXQpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCk7XG4gICAgfVxuICAgIHBhcnNlKGRhdGEsIHBhcmFtcykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnNhZmVQYXJzZShkYXRhLCBwYXJhbXMpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LmRhdGE7XG4gICAgICAgIHRocm93IHJlc3VsdC5lcnJvcjtcbiAgICB9XG4gICAgc2FmZVBhcnNlKGRhdGEsIHBhcmFtcykge1xuICAgICAgICBjb25zdCBjdHggPSB7XG4gICAgICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgICAgICAgIGFzeW5jOiBwYXJhbXM/LmFzeW5jID8/IGZhbHNlLFxuICAgICAgICAgICAgICAgIGNvbnRleHR1YWxFcnJvck1hcDogcGFyYW1zPy5lcnJvck1hcCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXRoOiBwYXJhbXM/LnBhdGggfHwgW10sXG4gICAgICAgICAgICBzY2hlbWFFcnJvck1hcDogdGhpcy5fZGVmLmVycm9yTWFwLFxuICAgICAgICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHBhcnNlZFR5cGU6IGdldFBhcnNlZFR5cGUoZGF0YSksXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlU3luYyh7IGRhdGEsIHBhdGg6IGN0eC5wYXRoLCBwYXJlbnQ6IGN0eCB9KTtcbiAgICAgICAgcmV0dXJuIGhhbmRsZVJlc3VsdChjdHgsIHJlc3VsdCk7XG4gICAgfVxuICAgIFwifnZhbGlkYXRlXCIoZGF0YSkge1xuICAgICAgICBjb25zdCBjdHggPSB7XG4gICAgICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgICAgICAgIGFzeW5jOiAhIXRoaXNbXCJ+c3RhbmRhcmRcIl0uYXN5bmMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aDogW10sXG4gICAgICAgICAgICBzY2hlbWFFcnJvck1hcDogdGhpcy5fZGVmLmVycm9yTWFwLFxuICAgICAgICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHBhcnNlZFR5cGU6IGdldFBhcnNlZFR5cGUoZGF0YSksXG4gICAgICAgIH07XG4gICAgICAgIGlmICghdGhpc1tcIn5zdGFuZGFyZFwiXS5hc3luYykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9wYXJzZVN5bmMoeyBkYXRhLCBwYXRoOiBbXSwgcGFyZW50OiBjdHggfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzVmFsaWQocmVzdWx0KVxuICAgICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc3N1ZXM6IGN0eC5jb21tb24uaXNzdWVzLFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnI/Lm1lc3NhZ2U/LnRvTG93ZXJDYXNlKCk/LmluY2x1ZGVzKFwiZW5jb3VudGVyZWRcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tcIn5zdGFuZGFyZFwiXS5hc3luYyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN0eC5jb21tb24gPSB7XG4gICAgICAgICAgICAgICAgICAgIGlzc3VlczogW10sXG4gICAgICAgICAgICAgICAgICAgIGFzeW5jOiB0cnVlLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcnNlQXN5bmMoeyBkYXRhLCBwYXRoOiBbXSwgcGFyZW50OiBjdHggfSkudGhlbigocmVzdWx0KSA9PiBpc1ZhbGlkKHJlc3VsdClcbiAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQudmFsdWUsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICA6IHtcbiAgICAgICAgICAgICAgICBpc3N1ZXM6IGN0eC5jb21tb24uaXNzdWVzLFxuICAgICAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIHBhcnNlQXN5bmMoZGF0YSwgcGFyYW1zKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuc2FmZVBhcnNlQXN5bmMoZGF0YSwgcGFyYW1zKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5kYXRhO1xuICAgICAgICB0aHJvdyByZXN1bHQuZXJyb3I7XG4gICAgfVxuICAgIGFzeW5jIHNhZmVQYXJzZUFzeW5jKGRhdGEsIHBhcmFtcykge1xuICAgICAgICBjb25zdCBjdHggPSB7XG4gICAgICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgICAgICAgIGNvbnRleHR1YWxFcnJvck1hcDogcGFyYW1zPy5lcnJvck1hcCxcbiAgICAgICAgICAgICAgICBhc3luYzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXRoOiBwYXJhbXM/LnBhdGggfHwgW10sXG4gICAgICAgICAgICBzY2hlbWFFcnJvck1hcDogdGhpcy5fZGVmLmVycm9yTWFwLFxuICAgICAgICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHBhcnNlZFR5cGU6IGdldFBhcnNlZFR5cGUoZGF0YSksXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IG1heWJlQXN5bmNSZXN1bHQgPSB0aGlzLl9wYXJzZSh7IGRhdGEsIHBhdGg6IGN0eC5wYXRoLCBwYXJlbnQ6IGN0eCB9KTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgKGlzQXN5bmMobWF5YmVBc3luY1Jlc3VsdCkgPyBtYXliZUFzeW5jUmVzdWx0IDogUHJvbWlzZS5yZXNvbHZlKG1heWJlQXN5bmNSZXN1bHQpKTtcbiAgICAgICAgcmV0dXJuIGhhbmRsZVJlc3VsdChjdHgsIHJlc3VsdCk7XG4gICAgfVxuICAgIHJlZmluZShjaGVjaywgbWVzc2FnZSkge1xuICAgICAgICBjb25zdCBnZXRJc3N1ZVByb3BlcnRpZXMgPSAodmFsKSA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG1lc3NhZ2UgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIG1lc3NhZ2UgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBtZXNzYWdlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1lc3NhZ2UodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBtZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVmaW5lbWVudCgodmFsLCBjdHgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGNoZWNrKHZhbCk7XG4gICAgICAgICAgICBjb25zdCBzZXRFcnJvciA9ICgpID0+IGN0eC5hZGRJc3N1ZSh7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmN1c3RvbSxcbiAgICAgICAgICAgICAgICAuLi5nZXRJc3N1ZVByb3BlcnRpZXModmFsKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBQcm9taXNlICE9PSBcInVuZGVmaW5lZFwiICYmIHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRFcnJvcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgc2V0RXJyb3IoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJlZmluZW1lbnQoY2hlY2ssIHJlZmluZW1lbnREYXRhKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWZpbmVtZW50KCh2YWwsIGN0eCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFjaGVjayh2YWwpKSB7XG4gICAgICAgICAgICAgICAgY3R4LmFkZElzc3VlKHR5cGVvZiByZWZpbmVtZW50RGF0YSA9PT0gXCJmdW5jdGlvblwiID8gcmVmaW5lbWVudERhdGEodmFsLCBjdHgpIDogcmVmaW5lbWVudERhdGEpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgX3JlZmluZW1lbnQocmVmaW5lbWVudCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZEVmZmVjdHMoe1xuICAgICAgICAgICAgc2NoZW1hOiB0aGlzLFxuICAgICAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RFZmZlY3RzLFxuICAgICAgICAgICAgZWZmZWN0OiB7IHR5cGU6IFwicmVmaW5lbWVudFwiLCByZWZpbmVtZW50IH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBzdXBlclJlZmluZShyZWZpbmVtZW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWZpbmVtZW50KHJlZmluZW1lbnQpO1xuICAgIH1cbiAgICBjb25zdHJ1Y3RvcihkZWYpIHtcbiAgICAgICAgLyoqIEFsaWFzIG9mIHNhZmVQYXJzZUFzeW5jICovXG4gICAgICAgIHRoaXMuc3BhID0gdGhpcy5zYWZlUGFyc2VBc3luYztcbiAgICAgICAgdGhpcy5fZGVmID0gZGVmO1xuICAgICAgICB0aGlzLnBhcnNlID0gdGhpcy5wYXJzZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnNhZmVQYXJzZSA9IHRoaXMuc2FmZVBhcnNlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMucGFyc2VBc3luYyA9IHRoaXMucGFyc2VBc3luYy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnNhZmVQYXJzZUFzeW5jID0gdGhpcy5zYWZlUGFyc2VBc3luYy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnNwYSA9IHRoaXMuc3BhLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMucmVmaW5lID0gdGhpcy5yZWZpbmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5yZWZpbmVtZW50ID0gdGhpcy5yZWZpbmVtZW50LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuc3VwZXJSZWZpbmUgPSB0aGlzLnN1cGVyUmVmaW5lLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMub3B0aW9uYWwgPSB0aGlzLm9wdGlvbmFsLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMubnVsbGFibGUgPSB0aGlzLm51bGxhYmxlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMubnVsbGlzaCA9IHRoaXMubnVsbGlzaC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmFycmF5ID0gdGhpcy5hcnJheS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnByb21pc2UgPSB0aGlzLnByb21pc2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5vciA9IHRoaXMub3IuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5hbmQgPSB0aGlzLmFuZC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnRyYW5zZm9ybSA9IHRoaXMudHJhbnNmb3JtLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuYnJhbmQgPSB0aGlzLmJyYW5kLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuZGVmYXVsdCA9IHRoaXMuZGVmYXVsdC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNhdGNoID0gdGhpcy5jYXRjaC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmRlc2NyaWJlID0gdGhpcy5kZXNjcmliZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLnBpcGUgPSB0aGlzLnBpcGUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5yZWFkb25seSA9IHRoaXMucmVhZG9ubHkuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5pc051bGxhYmxlID0gdGhpcy5pc051bGxhYmxlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuaXNPcHRpb25hbCA9IHRoaXMuaXNPcHRpb25hbC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzW1wifnN0YW5kYXJkXCJdID0ge1xuICAgICAgICAgICAgdmVyc2lvbjogMSxcbiAgICAgICAgICAgIHZlbmRvcjogXCJ6b2RcIixcbiAgICAgICAgICAgIHZhbGlkYXRlOiAoZGF0YSkgPT4gdGhpc1tcIn52YWxpZGF0ZVwiXShkYXRhKSxcbiAgICAgICAgfTtcbiAgICB9XG4gICAgb3B0aW9uYWwoKSB7XG4gICAgICAgIHJldHVybiBab2RPcHRpb25hbC5jcmVhdGUodGhpcywgdGhpcy5fZGVmKTtcbiAgICB9XG4gICAgbnVsbGFibGUoKSB7XG4gICAgICAgIHJldHVybiBab2ROdWxsYWJsZS5jcmVhdGUodGhpcywgdGhpcy5fZGVmKTtcbiAgICB9XG4gICAgbnVsbGlzaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubnVsbGFibGUoKS5vcHRpb25hbCgpO1xuICAgIH1cbiAgICBhcnJheSgpIHtcbiAgICAgICAgcmV0dXJuIFpvZEFycmF5LmNyZWF0ZSh0aGlzKTtcbiAgICB9XG4gICAgcHJvbWlzZSgpIHtcbiAgICAgICAgcmV0dXJuIFpvZFByb21pc2UuY3JlYXRlKHRoaXMsIHRoaXMuX2RlZik7XG4gICAgfVxuICAgIG9yKG9wdGlvbikge1xuICAgICAgICByZXR1cm4gWm9kVW5pb24uY3JlYXRlKFt0aGlzLCBvcHRpb25dLCB0aGlzLl9kZWYpO1xuICAgIH1cbiAgICBhbmQoaW5jb21pbmcpIHtcbiAgICAgICAgcmV0dXJuIFpvZEludGVyc2VjdGlvbi5jcmVhdGUodGhpcywgaW5jb21pbmcsIHRoaXMuX2RlZik7XG4gICAgfVxuICAgIHRyYW5zZm9ybSh0cmFuc2Zvcm0pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RFZmZlY3RzKHtcbiAgICAgICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXModGhpcy5fZGVmKSxcbiAgICAgICAgICAgIHNjaGVtYTogdGhpcyxcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRWZmZWN0cyxcbiAgICAgICAgICAgIGVmZmVjdDogeyB0eXBlOiBcInRyYW5zZm9ybVwiLCB0cmFuc2Zvcm0gfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGRlZmF1bHQoZGVmKSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRWYWx1ZUZ1bmMgPSB0eXBlb2YgZGVmID09PSBcImZ1bmN0aW9uXCIgPyBkZWYgOiAoKSA9PiBkZWY7XG4gICAgICAgIHJldHVybiBuZXcgWm9kRGVmYXVsdCh7XG4gICAgICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHRoaXMuX2RlZiksXG4gICAgICAgICAgICBpbm5lclR5cGU6IHRoaXMsXG4gICAgICAgICAgICBkZWZhdWx0VmFsdWU6IGRlZmF1bHRWYWx1ZUZ1bmMsXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZERlZmF1bHQsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBicmFuZCgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RCcmFuZGVkKHtcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kQnJhbmRlZCxcbiAgICAgICAgICAgIHR5cGU6IHRoaXMsXG4gICAgICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHRoaXMuX2RlZiksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBjYXRjaChkZWYpIHtcbiAgICAgICAgY29uc3QgY2F0Y2hWYWx1ZUZ1bmMgPSB0eXBlb2YgZGVmID09PSBcImZ1bmN0aW9uXCIgPyBkZWYgOiAoKSA9PiBkZWY7XG4gICAgICAgIHJldHVybiBuZXcgWm9kQ2F0Y2goe1xuICAgICAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyh0aGlzLl9kZWYpLFxuICAgICAgICAgICAgaW5uZXJUeXBlOiB0aGlzLFxuICAgICAgICAgICAgY2F0Y2hWYWx1ZTogY2F0Y2hWYWx1ZUZ1bmMsXG4gICAgICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZENhdGNoLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZGVzY3JpYmUoZGVzY3JpcHRpb24pIHtcbiAgICAgICAgY29uc3QgVGhpcyA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgVGhpcyh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHBpcGUodGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBab2RQaXBlbGluZS5jcmVhdGUodGhpcywgdGFyZ2V0KTtcbiAgICB9XG4gICAgcmVhZG9ubHkoKSB7XG4gICAgICAgIHJldHVybiBab2RSZWFkb25seS5jcmVhdGUodGhpcyk7XG4gICAgfVxuICAgIGlzT3B0aW9uYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNhZmVQYXJzZSh1bmRlZmluZWQpLnN1Y2Nlc3M7XG4gICAgfVxuICAgIGlzTnVsbGFibGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNhZmVQYXJzZShudWxsKS5zdWNjZXNzO1xuICAgIH1cbn1cbmNvbnN0IGN1aWRSZWdleCA9IC9eY1teXFxzLV17OCx9JC9pO1xuY29uc3QgY3VpZDJSZWdleCA9IC9eWzAtOWEtel0rJC87XG5jb25zdCB1bGlkUmVnZXggPSAvXlswLTlBLUhKS01OUC1UVi1aXXsyNn0kL2k7XG4vLyBjb25zdCB1dWlkUmVnZXggPVxuLy8gICAvXihbYS1mMC05XXs4fS1bYS1mMC05XXs0fS1bMS01XVthLWYwLTldezN9LVthLWYwLTldezR9LVthLWYwLTldezEyfXwwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDApJC9pO1xuY29uc3QgdXVpZFJlZ2V4ID0gL15bMC05YS1mQS1GXXs4fVxcYi1bMC05YS1mQS1GXXs0fVxcYi1bMC05YS1mQS1GXXs0fVxcYi1bMC05YS1mQS1GXXs0fVxcYi1bMC05YS1mQS1GXXsxMn0kL2k7XG5jb25zdCBuYW5vaWRSZWdleCA9IC9eW2EtejAtOV8tXXsyMX0kL2k7XG5jb25zdCBqd3RSZWdleCA9IC9eW0EtWmEtejAtOS1fXStcXC5bQS1aYS16MC05LV9dK1xcLltBLVphLXowLTktX10qJC87XG5jb25zdCBkdXJhdGlvblJlZ2V4ID0gL15bLStdP1AoPyEkKSg/Oig/OlstK10/XFxkK1kpfCg/OlstK10/XFxkK1suLF1cXGQrWSQpKT8oPzooPzpbLStdP1xcZCtNKXwoPzpbLStdP1xcZCtbLixdXFxkK00kKSk/KD86KD86Wy0rXT9cXGQrVyl8KD86Wy0rXT9cXGQrWy4sXVxcZCtXJCkpPyg/Oig/OlstK10/XFxkK0QpfCg/OlstK10/XFxkK1suLF1cXGQrRCQpKT8oPzpUKD89W1xcZCstXSkoPzooPzpbLStdP1xcZCtIKXwoPzpbLStdP1xcZCtbLixdXFxkK0gkKSk/KD86KD86Wy0rXT9cXGQrTSl8KD86Wy0rXT9cXGQrWy4sXVxcZCtNJCkpPyg/OlstK10/XFxkKyg/OlsuLF1cXGQrKT9TKT8pPz8kLztcbi8vIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzQ2MTgxLzE1NTAxNTVcbi8vIG9sZCB2ZXJzaW9uOiB0b28gc2xvdywgZGlkbid0IHN1cHBvcnQgdW5pY29kZVxuLy8gY29uc3QgZW1haWxSZWdleCA9IC9eKCgoW2Etel18XFxkfFshI1xcJCUmJ1xcKlxcK1xcLVxcLz1cXD9cXF5fYHtcXHx9fl18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKyhcXC4oW2Etel18XFxkfFshI1xcJCUmJ1xcKlxcK1xcLVxcLz1cXD9cXF5fYHtcXHx9fl18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKykqKXwoKFxceDIyKSgoKChcXHgyMHxcXHgwOSkqKFxceDBkXFx4MGEpKT8oXFx4MjB8XFx4MDkpKyk/KChbXFx4MDEtXFx4MDhcXHgwYlxceDBjXFx4MGUtXFx4MWZcXHg3Zl18XFx4MjF8W1xceDIzLVxceDViXXxbXFx4NWQtXFx4N2VdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoXFxcXChbXFx4MDEtXFx4MDlcXHgwYlxceDBjXFx4MGQtXFx4N2ZdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSkpKSooKChcXHgyMHxcXHgwOSkqKFxceDBkXFx4MGEpKT8oXFx4MjB8XFx4MDkpKyk/KFxceDIyKSkpQCgoKFthLXpdfFxcZHxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KChbYS16XXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKFthLXpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKihbYS16XXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKSlcXC4pKygoW2Etel18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCgoW2Etel18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKFthLXpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKihbYS16XXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkpKSQvaTtcbi8vb2xkIGVtYWlsIHJlZ2V4XG4vLyBjb25zdCBlbWFpbFJlZ2V4ID0gL14oKFtePD4oKVtcXF0uLDs6XFxzQFwiXSsoXFwuW148PigpW1xcXS4sOzpcXHNAXCJdKykqKXwoXCIuK1wiKSlAKCg/IS0pKFtePD4oKVtcXF0uLDs6XFxzQFwiXStcXC4pK1tePD4oKVtcXF0uLDs6XFxzQFwiXXsxLH0pW14tPD4oKVtcXF0uLDs6XFxzQFwiXSQvaTtcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuLy8gY29uc3QgZW1haWxSZWdleCA9XG4vLyAgIC9eKChbXjw+KClbXFxdXFxcXC4sOzpcXHNAXFxcIl0rKFxcLltePD4oKVtcXF1cXFxcLiw7Olxcc0BcXFwiXSspKil8KFxcXCIuK1xcXCIpKUAoKFxcWygoKDI1WzAtNV0pfCgyWzAtNF1bMC05XSl8KDFbMC05XXsyfSl8KFswLTldezEsMn0pKVxcLil7M30oKDI1WzAtNV0pfCgyWzAtNF1bMC05XSl8KDFbMC05XXsyfSl8KFswLTldezEsMn0pKVxcXSl8KFxcW0lQdjY6KChbYS1mMC05XXsxLDR9Oil7N318OjooW2EtZjAtOV17MSw0fTopezAsNn18KFthLWYwLTldezEsNH06KXsxfTooW2EtZjAtOV17MSw0fTopezAsNX18KFthLWYwLTldezEsNH06KXsyfTooW2EtZjAtOV17MSw0fTopezAsNH18KFthLWYwLTldezEsNH06KXszfTooW2EtZjAtOV17MSw0fTopezAsM318KFthLWYwLTldezEsNH06KXs0fTooW2EtZjAtOV17MSw0fTopezAsMn18KFthLWYwLTldezEsNH06KXs1fTooW2EtZjAtOV17MSw0fTopezAsMX0pKFthLWYwLTldezEsNH18KCgoMjVbMC01XSl8KDJbMC00XVswLTldKXwoMVswLTldezJ9KXwoWzAtOV17MSwyfSkpXFwuKXszfSgoMjVbMC01XSl8KDJbMC00XVswLTldKXwoMVswLTldezJ9KXwoWzAtOV17MSwyfSkpKVxcXSl8KFtBLVphLXowLTldKFtBLVphLXowLTktXSpbQS1aYS16MC05XSkqKFxcLltBLVphLXpdezIsfSkrKSkkLztcbi8vIGNvbnN0IGVtYWlsUmVnZXggPVxuLy8gICAvXlthLXpBLVowLTlcXC5cXCFcXCNcXCRcXCVcXCZcXCdcXCpcXCtcXC9cXD1cXD9cXF5cXF9cXGBcXHtcXHxcXH1cXH5cXC1dK0BbYS16QS1aMC05XSg/OlthLXpBLVowLTktXXswLDYxfVthLXpBLVowLTldKT8oPzpcXC5bYS16QS1aMC05XSg/OlthLXpBLVowLTktXXswLDYxfVthLXpBLVowLTldKT8pKiQvO1xuLy8gY29uc3QgZW1haWxSZWdleCA9XG4vLyAgIC9eKD86W2EtejAtOSEjJCUmJyorLz0/Xl9ge3x9fi1dKyg/OlxcLlthLXowLTkhIyQlJicqKy89P15fYHt8fX4tXSspKnxcIig/OltcXHgwMS1cXHgwOFxceDBiXFx4MGNcXHgwZS1cXHgxZlxceDIxXFx4MjMtXFx4NWJcXHg1ZC1cXHg3Zl18XFxcXFtcXHgwMS1cXHgwOVxceDBiXFx4MGNcXHgwZS1cXHg3Zl0pKlwiKUAoPzooPzpbYS16MC05XSg/OlthLXowLTktXSpbYS16MC05XSk/XFwuKStbYS16MC05XSg/OlthLXowLTktXSpbYS16MC05XSk/fFxcWyg/Oig/OjI1WzAtNV18MlswLTRdWzAtOV18WzAxXT9bMC05XVswLTldPylcXC4pezN9KD86MjVbMC01XXwyWzAtNF1bMC05XXxbMDFdP1swLTldWzAtOV0/fFthLXowLTktXSpbYS16MC05XTooPzpbXFx4MDEtXFx4MDhcXHgwYlxceDBjXFx4MGUtXFx4MWZcXHgyMS1cXHg1YVxceDUzLVxceDdmXXxcXFxcW1xceDAxLVxceDA5XFx4MGJcXHgwY1xceDBlLVxceDdmXSkrKVxcXSkkL2k7XG5jb25zdCBlbWFpbFJlZ2V4ID0gL14oPyFcXC4pKD8hLipcXC5cXC4pKFtBLVowLTlfJytcXC1cXC5dKilbQS1aMC05XystXUAoW0EtWjAtOV1bQS1aMC05XFwtXSpcXC4pK1tBLVpdezIsfSQvaTtcbi8vIGNvbnN0IGVtYWlsUmVnZXggPVxuLy8gICAvXlthLXowLTkuISMkJSZcdTIwMTkqKy89P15fYHt8fX4tXStAW2EtejAtOS1dKyg/OlxcLlthLXowLTlcXC1dKykqJC9pO1xuLy8gZnJvbSBodHRwczovL3RoZWtldmluc2NvdHQuY29tL2Vtb2ppcy1pbi1qYXZhc2NyaXB0LyN3cml0aW5nLWEtcmVndWxhci1leHByZXNzaW9uXG5jb25zdCBfZW1vamlSZWdleCA9IGBeKFxcXFxwe0V4dGVuZGVkX1BpY3RvZ3JhcGhpY318XFxcXHB7RW1vamlfQ29tcG9uZW50fSkrJGA7XG5sZXQgZW1vamlSZWdleDtcbi8vIGZhc3Rlciwgc2ltcGxlciwgc2FmZXJcbmNvbnN0IGlwdjRSZWdleCA9IC9eKD86KD86MjVbMC01XXwyWzAtNF1bMC05XXwxWzAtOV1bMC05XXxbMS05XVswLTldfFswLTldKVxcLil7M30oPzoyNVswLTVdfDJbMC00XVswLTldfDFbMC05XVswLTldfFsxLTldWzAtOV18WzAtOV0pJC87XG5jb25zdCBpcHY0Q2lkclJlZ2V4ID0gL14oPzooPzoyNVswLTVdfDJbMC00XVswLTldfDFbMC05XVswLTldfFsxLTldWzAtOV18WzAtOV0pXFwuKXszfSg/OjI1WzAtNV18MlswLTRdWzAtOV18MVswLTldWzAtOV18WzEtOV1bMC05XXxbMC05XSlcXC8oM1swLTJdfFsxMl0/WzAtOV0pJC87XG4vLyBjb25zdCBpcHY2UmVnZXggPVxuLy8gL14oKFthLWYwLTldezEsNH06KXs3fXw6OihbYS1mMC05XXsxLDR9Oil7MCw2fXwoW2EtZjAtOV17MSw0fTopezF9OihbYS1mMC05XXsxLDR9Oil7MCw1fXwoW2EtZjAtOV17MSw0fTopezJ9OihbYS1mMC05XXsxLDR9Oil7MCw0fXwoW2EtZjAtOV17MSw0fTopezN9OihbYS1mMC05XXsxLDR9Oil7MCwzfXwoW2EtZjAtOV17MSw0fTopezR9OihbYS1mMC05XXsxLDR9Oil7MCwyfXwoW2EtZjAtOV17MSw0fTopezV9OihbYS1mMC05XXsxLDR9Oil7MCwxfSkoW2EtZjAtOV17MSw0fXwoKCgyNVswLTVdKXwoMlswLTRdWzAtOV0pfCgxWzAtOV17Mn0pfChbMC05XXsxLDJ9KSlcXC4pezN9KCgyNVswLTVdKXwoMlswLTRdWzAtOV0pfCgxWzAtOV17Mn0pfChbMC05XXsxLDJ9KSkpJC87XG5jb25zdCBpcHY2UmVnZXggPSAvXigoWzAtOWEtZkEtRl17MSw0fTopezcsN31bMC05YS1mQS1GXXsxLDR9fChbMC05YS1mQS1GXXsxLDR9Oil7MSw3fTp8KFswLTlhLWZBLUZdezEsNH06KXsxLDZ9OlswLTlhLWZBLUZdezEsNH18KFswLTlhLWZBLUZdezEsNH06KXsxLDV9KDpbMC05YS1mQS1GXXsxLDR9KXsxLDJ9fChbMC05YS1mQS1GXXsxLDR9Oil7MSw0fSg6WzAtOWEtZkEtRl17MSw0fSl7MSwzfXwoWzAtOWEtZkEtRl17MSw0fTopezEsM30oOlswLTlhLWZBLUZdezEsNH0pezEsNH18KFswLTlhLWZBLUZdezEsNH06KXsxLDJ9KDpbMC05YS1mQS1GXXsxLDR9KXsxLDV9fFswLTlhLWZBLUZdezEsNH06KCg6WzAtOWEtZkEtRl17MSw0fSl7MSw2fSl8OigoOlswLTlhLWZBLUZdezEsNH0pezEsN318Oil8ZmU4MDooOlswLTlhLWZBLUZdezAsNH0pezAsNH0lWzAtOWEtekEtWl17MSx9fDo6KGZmZmYoOjB7MSw0fSl7MCwxfTopezAsMX0oKDI1WzAtNV18KDJbMC00XXwxezAsMX1bMC05XSl7MCwxfVswLTldKVxcLil7MywzfSgyNVswLTVdfCgyWzAtNF18MXswLDF9WzAtOV0pezAsMX1bMC05XSl8KFswLTlhLWZBLUZdezEsNH06KXsxLDR9OigoMjVbMC01XXwoMlswLTRdfDF7MCwxfVswLTldKXswLDF9WzAtOV0pXFwuKXszLDN9KDI1WzAtNV18KDJbMC00XXwxezAsMX1bMC05XSl7MCwxfVswLTldKSkkLztcbmNvbnN0IGlwdjZDaWRyUmVnZXggPSAvXigoWzAtOWEtZkEtRl17MSw0fTopezcsN31bMC05YS1mQS1GXXsxLDR9fChbMC05YS1mQS1GXXsxLDR9Oil7MSw3fTp8KFswLTlhLWZBLUZdezEsNH06KXsxLDZ9OlswLTlhLWZBLUZdezEsNH18KFswLTlhLWZBLUZdezEsNH06KXsxLDV9KDpbMC05YS1mQS1GXXsxLDR9KXsxLDJ9fChbMC05YS1mQS1GXXsxLDR9Oil7MSw0fSg6WzAtOWEtZkEtRl17MSw0fSl7MSwzfXwoWzAtOWEtZkEtRl17MSw0fTopezEsM30oOlswLTlhLWZBLUZdezEsNH0pezEsNH18KFswLTlhLWZBLUZdezEsNH06KXsxLDJ9KDpbMC05YS1mQS1GXXsxLDR9KXsxLDV9fFswLTlhLWZBLUZdezEsNH06KCg6WzAtOWEtZkEtRl17MSw0fSl7MSw2fSl8OigoOlswLTlhLWZBLUZdezEsNH0pezEsN318Oil8ZmU4MDooOlswLTlhLWZBLUZdezAsNH0pezAsNH0lWzAtOWEtekEtWl17MSx9fDo6KGZmZmYoOjB7MSw0fSl7MCwxfTopezAsMX0oKDI1WzAtNV18KDJbMC00XXwxezAsMX1bMC05XSl7MCwxfVswLTldKVxcLil7MywzfSgyNVswLTVdfCgyWzAtNF18MXswLDF9WzAtOV0pezAsMX1bMC05XSl8KFswLTlhLWZBLUZdezEsNH06KXsxLDR9OigoMjVbMC01XXwoMlswLTRdfDF7MCwxfVswLTldKXswLDF9WzAtOV0pXFwuKXszLDN9KDI1WzAtNV18KDJbMC00XXwxezAsMX1bMC05XSl7MCwxfVswLTldKSlcXC8oMTJbMC04XXwxWzAxXVswLTldfFsxLTldP1swLTldKSQvO1xuLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNzg2MDM5Mi9kZXRlcm1pbmUtaWYtc3RyaW5nLWlzLWluLWJhc2U2NC11c2luZy1qYXZhc2NyaXB0XG5jb25zdCBiYXNlNjRSZWdleCA9IC9eKFswLTlhLXpBLVorL117NH0pKigoWzAtOWEtekEtWisvXXsyfT09KXwoWzAtOWEtekEtWisvXXszfT0pKT8kLztcbi8vIGh0dHBzOi8vYmFzZTY0Lmd1cnUvc3RhbmRhcmRzL2Jhc2U2NHVybFxuY29uc3QgYmFzZTY0dXJsUmVnZXggPSAvXihbMC05YS16QS1aLV9dezR9KSooKFswLTlhLXpBLVotX117Mn0oPT0pPyl8KFswLTlhLXpBLVotX117M30oPSk/KSk/JC87XG4vLyBzaW1wbGVcbi8vIGNvbnN0IGRhdGVSZWdleFNvdXJjZSA9IGBcXFxcZHs0fS1cXFxcZHsyfS1cXFxcZHsyfWA7XG4vLyBubyBsZWFwIHllYXIgdmFsaWRhdGlvblxuLy8gY29uc3QgZGF0ZVJlZ2V4U291cmNlID0gYFxcXFxkezR9LSgoMFsxMzU3OF18MTB8MTIpLTMxfCgwWzEzLTldfDFbMC0yXSktMzB8KDBbMS05XXwxWzAtMl0pLSgwWzEtOV18MVxcXFxkfDJcXFxcZCkpYDtcbi8vIHdpdGggbGVhcCB5ZWFyIHZhbGlkYXRpb25cbmNvbnN0IGRhdGVSZWdleFNvdXJjZSA9IGAoKFxcXFxkXFxcXGRbMjQ2OF1bMDQ4XXxcXFxcZFxcXFxkWzEzNTc5XVsyNl18XFxcXGRcXFxcZDBbNDhdfFswMjQ2OF1bMDQ4XTAwfFsxMzU3OV1bMjZdMDApLTAyLTI5fFxcXFxkezR9LSgoMFsxMzU3OF18MVswMl0pLSgwWzEtOV18WzEyXVxcXFxkfDNbMDFdKXwoMFs0NjldfDExKS0oMFsxLTldfFsxMl1cXFxcZHwzMCl8KDAyKS0oMFsxLTldfDFcXFxcZHwyWzAtOF0pKSlgO1xuY29uc3QgZGF0ZVJlZ2V4ID0gbmV3IFJlZ0V4cChgXiR7ZGF0ZVJlZ2V4U291cmNlfSRgKTtcbmZ1bmN0aW9uIHRpbWVSZWdleFNvdXJjZShhcmdzKSB7XG4gICAgbGV0IHNlY29uZHNSZWdleFNvdXJjZSA9IGBbMC01XVxcXFxkYDtcbiAgICBpZiAoYXJncy5wcmVjaXNpb24pIHtcbiAgICAgICAgc2Vjb25kc1JlZ2V4U291cmNlID0gYCR7c2Vjb25kc1JlZ2V4U291cmNlfVxcXFwuXFxcXGR7JHthcmdzLnByZWNpc2lvbn19YDtcbiAgICB9XG4gICAgZWxzZSBpZiAoYXJncy5wcmVjaXNpb24gPT0gbnVsbCkge1xuICAgICAgICBzZWNvbmRzUmVnZXhTb3VyY2UgPSBgJHtzZWNvbmRzUmVnZXhTb3VyY2V9KFxcXFwuXFxcXGQrKT9gO1xuICAgIH1cbiAgICBjb25zdCBzZWNvbmRzUXVhbnRpZmllciA9IGFyZ3MucHJlY2lzaW9uID8gXCIrXCIgOiBcIj9cIjsgLy8gcmVxdWlyZSBzZWNvbmRzIGlmIHByZWNpc2lvbiBpcyBub256ZXJvXG4gICAgcmV0dXJuIGAoWzAxXVxcXFxkfDJbMC0zXSk6WzAtNV1cXFxcZCg6JHtzZWNvbmRzUmVnZXhTb3VyY2V9KSR7c2Vjb25kc1F1YW50aWZpZXJ9YDtcbn1cbmZ1bmN0aW9uIHRpbWVSZWdleChhcmdzKSB7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoYF4ke3RpbWVSZWdleFNvdXJjZShhcmdzKX0kYCk7XG59XG4vLyBBZGFwdGVkIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzMxNDMyMzFcbmV4cG9ydCBmdW5jdGlvbiBkYXRldGltZVJlZ2V4KGFyZ3MpIHtcbiAgICBsZXQgcmVnZXggPSBgJHtkYXRlUmVnZXhTb3VyY2V9VCR7dGltZVJlZ2V4U291cmNlKGFyZ3MpfWA7XG4gICAgY29uc3Qgb3B0cyA9IFtdO1xuICAgIG9wdHMucHVzaChhcmdzLmxvY2FsID8gYFo/YCA6IGBaYCk7XG4gICAgaWYgKGFyZ3Mub2Zmc2V0KVxuICAgICAgICBvcHRzLnB1c2goYChbKy1dXFxcXGR7Mn06P1xcXFxkezJ9KWApO1xuICAgIHJlZ2V4ID0gYCR7cmVnZXh9KCR7b3B0cy5qb2luKFwifFwiKX0pYDtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cChgXiR7cmVnZXh9JGApO1xufVxuZnVuY3Rpb24gaXNWYWxpZElQKGlwLCB2ZXJzaW9uKSB7XG4gICAgaWYgKCh2ZXJzaW9uID09PSBcInY0XCIgfHwgIXZlcnNpb24pICYmIGlwdjRSZWdleC50ZXN0KGlwKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCh2ZXJzaW9uID09PSBcInY2XCIgfHwgIXZlcnNpb24pICYmIGlwdjZSZWdleC50ZXN0KGlwKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gaXNWYWxpZEpXVChqd3QsIGFsZykge1xuICAgIGlmICghand0UmVnZXgudGVzdChqd3QpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgW2hlYWRlcl0gPSBqd3Quc3BsaXQoXCIuXCIpO1xuICAgICAgICBpZiAoIWhlYWRlcilcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgLy8gQ29udmVydCBiYXNlNjR1cmwgdG8gYmFzZTY0XG4gICAgICAgIGNvbnN0IGJhc2U2NCA9IGhlYWRlclxuICAgICAgICAgICAgLnJlcGxhY2UoLy0vZywgXCIrXCIpXG4gICAgICAgICAgICAucmVwbGFjZSgvXy9nLCBcIi9cIilcbiAgICAgICAgICAgIC5wYWRFbmQoaGVhZGVyLmxlbmd0aCArICgoNCAtIChoZWFkZXIubGVuZ3RoICUgNCkpICUgNCksIFwiPVwiKTtcbiAgICAgICAgY29uc3QgZGVjb2RlZCA9IEpTT04ucGFyc2UoYXRvYihiYXNlNjQpKTtcbiAgICAgICAgaWYgKHR5cGVvZiBkZWNvZGVkICE9PSBcIm9iamVjdFwiIHx8IGRlY29kZWQgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChcInR5cFwiIGluIGRlY29kZWQgJiYgZGVjb2RlZD8udHlwICE9PSBcIkpXVFwiKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoIWRlY29kZWQuYWxnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoYWxnICYmIGRlY29kZWQuYWxnICE9PSBhbGcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5mdW5jdGlvbiBpc1ZhbGlkQ2lkcihpcCwgdmVyc2lvbikge1xuICAgIGlmICgodmVyc2lvbiA9PT0gXCJ2NFwiIHx8ICF2ZXJzaW9uKSAmJiBpcHY0Q2lkclJlZ2V4LnRlc3QoaXApKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoKHZlcnNpb24gPT09IFwidjZcIiB8fCAhdmVyc2lvbikgJiYgaXB2NkNpZHJSZWdleC50ZXN0KGlwKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuZXhwb3J0IGNsYXNzIFpvZFN0cmluZyBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBpZiAodGhpcy5fZGVmLmNvZXJjZSkge1xuICAgICAgICAgICAgaW5wdXQuZGF0YSA9IFN0cmluZyhpbnB1dC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLnN0cmluZykge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5zdHJpbmcsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdGF0dXMgPSBuZXcgUGFyc2VTdGF0dXMoKTtcbiAgICAgICAgbGV0IGN0eCA9IHVuZGVmaW5lZDtcbiAgICAgICAgZm9yIChjb25zdCBjaGVjayBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2hlY2sua2luZCA9PT0gXCJtaW5cIikge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5kYXRhLmxlbmd0aCA8IGNoZWNrLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBleGFjdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJtYXhcIikge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5kYXRhLmxlbmd0aCA+IGNoZWNrLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fYmlnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwibGVuZ3RoXCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29CaWcgPSBpbnB1dC5kYXRhLmxlbmd0aCA+IGNoZWNrLnZhbHVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb1NtYWxsID0gaW5wdXQuZGF0YS5sZW5ndGggPCBjaGVjay52YWx1ZTtcbiAgICAgICAgICAgICAgICBpZiAodG9vQmlnIHx8IHRvb1NtYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9vQmlnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX2JpZyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhpbXVtOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGFjdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodG9vU21hbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluaW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiZW1haWxcIikge1xuICAgICAgICAgICAgICAgIGlmICghZW1haWxSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiZW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImVtb2ppXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVtb2ppUmVnZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlSZWdleCA9IG5ldyBSZWdFeHAoX2Vtb2ppUmVnZXgsIFwidVwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFlbW9qaVJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJlbW9qaVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwidXVpZFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF1dWlkUmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcInV1aWRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcIm5hbm9pZFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFuYW5vaWRSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwibmFub2lkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJjdWlkXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWN1aWRSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiY3VpZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiY3VpZDJcIikge1xuICAgICAgICAgICAgICAgIGlmICghY3VpZDJSZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiY3VpZDJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcInVsaWRcIikge1xuICAgICAgICAgICAgICAgIGlmICghdWxpZFJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJ1bGlkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJ1cmxcIikge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIG5ldyBVUkwoaW5wdXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJ1cmxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcInJlZ2V4XCIpIHtcbiAgICAgICAgICAgICAgICBjaGVjay5yZWdleC5sYXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlc3RSZXN1bHQgPSBjaGVjay5yZWdleC50ZXN0KGlucHV0LmRhdGEpO1xuICAgICAgICAgICAgICAgIGlmICghdGVzdFJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcInJlZ2V4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJ0cmltXCIpIHtcbiAgICAgICAgICAgICAgICBpbnB1dC5kYXRhID0gaW5wdXQuZGF0YS50cmltKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImluY2x1ZGVzXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlucHV0LmRhdGEuaW5jbHVkZXMoY2hlY2sudmFsdWUsIGNoZWNrLnBvc2l0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiB7IGluY2x1ZGVzOiBjaGVjay52YWx1ZSwgcG9zaXRpb246IGNoZWNrLnBvc2l0aW9uIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJ0b0xvd2VyQ2FzZVwiKSB7XG4gICAgICAgICAgICAgICAgaW5wdXQuZGF0YSA9IGlucHV0LmRhdGEudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwidG9VcHBlckNhc2VcIikge1xuICAgICAgICAgICAgICAgIGlucHV0LmRhdGEgPSBpbnB1dC5kYXRhLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcInN0YXJ0c1dpdGhcIikge1xuICAgICAgICAgICAgICAgIGlmICghaW5wdXQuZGF0YS5zdGFydHNXaXRoKGNoZWNrLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiB7IHN0YXJ0c1dpdGg6IGNoZWNrLnZhbHVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJlbmRzV2l0aFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpbnB1dC5kYXRhLmVuZHNXaXRoKGNoZWNrLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiB7IGVuZHNXaXRoOiBjaGVjay52YWx1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiZGF0ZXRpbWVcIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gZGF0ZXRpbWVSZWdleChjaGVjayk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KGlucHV0LmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiZGF0ZXRpbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImRhdGVcIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gZGF0ZVJlZ2V4O1xuICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImRhdGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcInRpbWVcIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gdGltZVJlZ2V4KGNoZWNrKTtcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJ0aW1lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJkdXJhdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFkdXJhdGlvblJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJkdXJhdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiaXBcIikge1xuICAgICAgICAgICAgICAgIGlmICghaXNWYWxpZElQKGlucHV0LmRhdGEsIGNoZWNrLnZlcnNpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb246IFwiaXBcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImp3dFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1ZhbGlkSldUKGlucHV0LmRhdGEsIGNoZWNrLmFsZykpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJqd3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImNpZHJcIikge1xuICAgICAgICAgICAgICAgIGlmICghaXNWYWxpZENpZHIoaW5wdXQuZGF0YSwgY2hlY2sudmVyc2lvbikpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJjaWRyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJiYXNlNjRcIikge1xuICAgICAgICAgICAgICAgIGlmICghYmFzZTY0UmVnZXgudGVzdChpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiBcImJhc2U2NFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwiYmFzZTY0dXJsXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWJhc2U2NHVybFJlZ2V4LnRlc3QoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogXCJiYXNlNjR1cmxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3N0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB1dGlsLmFzc2VydE5ldmVyKGNoZWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdGF0dXM6IHN0YXR1cy52YWx1ZSwgdmFsdWU6IGlucHV0LmRhdGEgfTtcbiAgICB9XG4gICAgX3JlZ2V4KHJlZ2V4LCB2YWxpZGF0aW9uLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlZmluZW1lbnQoKGRhdGEpID0+IHJlZ2V4LnRlc3QoZGF0YSksIHtcbiAgICAgICAgICAgIHZhbGlkYXRpb24sXG4gICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9zdHJpbmcsXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBfYWRkQ2hlY2soY2hlY2spIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RTdHJpbmcoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgY2hlY2tzOiBbLi4udGhpcy5fZGVmLmNoZWNrcywgY2hlY2tdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZW1haWwobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImVtYWlsXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgdXJsKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJ1cmxcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpIH0pO1xuICAgIH1cbiAgICBlbW9qaShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwiZW1vamlcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpIH0pO1xuICAgIH1cbiAgICB1dWlkKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJ1dWlkXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgbmFub2lkKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJuYW5vaWRcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpIH0pO1xuICAgIH1cbiAgICBjdWlkKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJjdWlkXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgY3VpZDIobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImN1aWQyXCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgdWxpZChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwidWxpZFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIGJhc2U2NChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwiYmFzZTY0XCIsIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSB9KTtcbiAgICB9XG4gICAgYmFzZTY0dXJsKG1lc3NhZ2UpIHtcbiAgICAgICAgLy8gYmFzZTY0dXJsIGVuY29kaW5nIGlzIGEgbW9kaWZpY2F0aW9uIG9mIGJhc2U2NCB0aGF0IGNhbiBzYWZlbHkgYmUgdXNlZCBpbiBVUkxzIGFuZCBmaWxlbmFtZXNcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwiYmFzZTY0dXJsXCIsXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBqd3Qob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImp3dFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoob3B0aW9ucykgfSk7XG4gICAgfVxuICAgIGlwKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJpcFwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoob3B0aW9ucykgfSk7XG4gICAgfVxuICAgIGNpZHIob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soeyBraW5kOiBcImNpZHJcIiwgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG9wdGlvbnMpIH0pO1xuICAgIH1cbiAgICBkYXRldGltZShvcHRpb25zKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgICAgICBraW5kOiBcImRhdGV0aW1lXCIsXG4gICAgICAgICAgICAgICAgcHJlY2lzaW9uOiBudWxsLFxuICAgICAgICAgICAgICAgIG9mZnNldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbG9jYWw6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG9wdGlvbnMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJkYXRldGltZVwiLFxuICAgICAgICAgICAgcHJlY2lzaW9uOiB0eXBlb2Ygb3B0aW9ucz8ucHJlY2lzaW9uID09PSBcInVuZGVmaW5lZFwiID8gbnVsbCA6IG9wdGlvbnM/LnByZWNpc2lvbixcbiAgICAgICAgICAgIG9mZnNldDogb3B0aW9ucz8ub2Zmc2V0ID8/IGZhbHNlLFxuICAgICAgICAgICAgbG9jYWw6IG9wdGlvbnM/LmxvY2FsID8/IGZhbHNlLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG9wdGlvbnM/Lm1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZGF0ZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7IGtpbmQ6IFwiZGF0ZVwiLCBtZXNzYWdlIH0pO1xuICAgIH1cbiAgICB0aW1lKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAgICAgIGtpbmQ6IFwidGltZVwiLFxuICAgICAgICAgICAgICAgIHByZWNpc2lvbjogbnVsbCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBvcHRpb25zLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwidGltZVwiLFxuICAgICAgICAgICAgcHJlY2lzaW9uOiB0eXBlb2Ygb3B0aW9ucz8ucHJlY2lzaW9uID09PSBcInVuZGVmaW5lZFwiID8gbnVsbCA6IG9wdGlvbnM/LnByZWNpc2lvbixcbiAgICAgICAgICAgIC4uLmVycm9yVXRpbC5lcnJUb09iaihvcHRpb25zPy5tZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGR1cmF0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHsga2luZDogXCJkdXJhdGlvblwiLCAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkgfSk7XG4gICAgfVxuICAgIHJlZ2V4KHJlZ2V4LCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcInJlZ2V4XCIsXG4gICAgICAgICAgICByZWdleDogcmVnZXgsXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpbmNsdWRlcyh2YWx1ZSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJpbmNsdWRlc1wiLFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgcG9zaXRpb246IG9wdGlvbnM/LnBvc2l0aW9uLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG9wdGlvbnM/Lm1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgc3RhcnRzV2l0aCh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJzdGFydHNXaXRoXCIsXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbmRzV2l0aCh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJlbmRzV2l0aFwiLFxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbWluKG1pbkxlbmd0aCwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtaW5cIixcbiAgICAgICAgICAgIHZhbHVlOiBtaW5MZW5ndGgsXG4gICAgICAgICAgICAuLi5lcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBtYXgobWF4TGVuZ3RoLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1heFwiLFxuICAgICAgICAgICAgdmFsdWU6IG1heExlbmd0aCxcbiAgICAgICAgICAgIC4uLmVycm9yVXRpbC5lcnJUb09iaihtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGxlbmd0aChsZW4sIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibGVuZ3RoXCIsXG4gICAgICAgICAgICB2YWx1ZTogbGVuLFxuICAgICAgICAgICAgLi4uZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRXF1aXZhbGVudCB0byBgLm1pbigxKWBcbiAgICAgKi9cbiAgICBub25lbXB0eShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbigxLCBlcnJvclV0aWwuZXJyVG9PYmoobWVzc2FnZSkpO1xuICAgIH1cbiAgICB0cmltKCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZFN0cmluZyh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjaGVja3M6IFsuLi50aGlzLl9kZWYuY2hlY2tzLCB7IGtpbmQ6IFwidHJpbVwiIH1dLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgdG9Mb3dlckNhc2UoKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kU3RyaW5nKHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogWy4uLnRoaXMuX2RlZi5jaGVja3MsIHsga2luZDogXCJ0b0xvd2VyQ2FzZVwiIH1dLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgdG9VcHBlckNhc2UoKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kU3RyaW5nKHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogWy4uLnRoaXMuX2RlZi5jaGVja3MsIHsga2luZDogXCJ0b1VwcGVyQ2FzZVwiIH1dLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZ2V0IGlzRGF0ZXRpbWUoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiZGF0ZXRpbWVcIik7XG4gICAgfVxuICAgIGdldCBpc0RhdGUoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiZGF0ZVwiKTtcbiAgICB9XG4gICAgZ2V0IGlzVGltZSgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJ0aW1lXCIpO1xuICAgIH1cbiAgICBnZXQgaXNEdXJhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJkdXJhdGlvblwiKTtcbiAgICB9XG4gICAgZ2V0IGlzRW1haWwoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiZW1haWxcIik7XG4gICAgfVxuICAgIGdldCBpc1VSTCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJ1cmxcIik7XG4gICAgfVxuICAgIGdldCBpc0Vtb2ppKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImVtb2ppXCIpO1xuICAgIH1cbiAgICBnZXQgaXNVVUlEKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcInV1aWRcIik7XG4gICAgfVxuICAgIGdldCBpc05BTk9JRCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fZGVmLmNoZWNrcy5maW5kKChjaCkgPT4gY2gua2luZCA9PT0gXCJuYW5vaWRcIik7XG4gICAgfVxuICAgIGdldCBpc0NVSUQoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiY3VpZFwiKTtcbiAgICB9XG4gICAgZ2V0IGlzQ1VJRDIoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiY3VpZDJcIik7XG4gICAgfVxuICAgIGdldCBpc1VMSUQoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwidWxpZFwiKTtcbiAgICB9XG4gICAgZ2V0IGlzSVAoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiaXBcIik7XG4gICAgfVxuICAgIGdldCBpc0NJRFIoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX2RlZi5jaGVja3MuZmluZCgoY2gpID0+IGNoLmtpbmQgPT09IFwiY2lkclwiKTtcbiAgICB9XG4gICAgZ2V0IGlzQmFzZTY0KCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImJhc2U2NFwiKTtcbiAgICB9XG4gICAgZ2V0IGlzQmFzZTY0dXJsKCkge1xuICAgICAgICAvLyBiYXNlNjR1cmwgZW5jb2RpbmcgaXMgYSBtb2RpZmljYXRpb24gb2YgYmFzZTY0IHRoYXQgY2FuIHNhZmVseSBiZSB1c2VkIGluIFVSTHMgYW5kIGZpbGVuYW1lc1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImJhc2U2NHVybFwiKTtcbiAgICB9XG4gICAgZ2V0IG1pbkxlbmd0aCgpIHtcbiAgICAgICAgbGV0IG1pbiA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluID09PSBudWxsIHx8IGNoLnZhbHVlID4gbWluKVxuICAgICAgICAgICAgICAgICAgICBtaW4gPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWluO1xuICAgIH1cbiAgICBnZXQgbWF4TGVuZ3RoKCkge1xuICAgICAgICBsZXQgbWF4ID0gbnVsbDtcbiAgICAgICAgZm9yIChjb25zdCBjaCBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2gua2luZCA9PT0gXCJtYXhcIikge1xuICAgICAgICAgICAgICAgIGlmIChtYXggPT09IG51bGwgfHwgY2gudmFsdWUgPCBtYXgpXG4gICAgICAgICAgICAgICAgICAgIG1heCA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXg7XG4gICAgfVxufVxuWm9kU3RyaW5nLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFN0cmluZyh7XG4gICAgICAgIGNoZWNrczogW10sXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kU3RyaW5nLFxuICAgICAgICBjb2VyY2U6IHBhcmFtcz8uY29lcmNlID8/IGZhbHNlLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzk2NjQ4NC93aHktZG9lcy1tb2R1bHVzLW9wZXJhdG9yLXJldHVybi1mcmFjdGlvbmFsLW51bWJlci1pbi1qYXZhc2NyaXB0LzMxNzExMDM0IzMxNzExMDM0XG5mdW5jdGlvbiBmbG9hdFNhZmVSZW1haW5kZXIodmFsLCBzdGVwKSB7XG4gICAgY29uc3QgdmFsRGVjQ291bnQgPSAodmFsLnRvU3RyaW5nKCkuc3BsaXQoXCIuXCIpWzFdIHx8IFwiXCIpLmxlbmd0aDtcbiAgICBjb25zdCBzdGVwRGVjQ291bnQgPSAoc3RlcC50b1N0cmluZygpLnNwbGl0KFwiLlwiKVsxXSB8fCBcIlwiKS5sZW5ndGg7XG4gICAgY29uc3QgZGVjQ291bnQgPSB2YWxEZWNDb3VudCA+IHN0ZXBEZWNDb3VudCA/IHZhbERlY0NvdW50IDogc3RlcERlY0NvdW50O1xuICAgIGNvbnN0IHZhbEludCA9IE51bWJlci5wYXJzZUludCh2YWwudG9GaXhlZChkZWNDb3VudCkucmVwbGFjZShcIi5cIiwgXCJcIikpO1xuICAgIGNvbnN0IHN0ZXBJbnQgPSBOdW1iZXIucGFyc2VJbnQoc3RlcC50b0ZpeGVkKGRlY0NvdW50KS5yZXBsYWNlKFwiLlwiLCBcIlwiKSk7XG4gICAgcmV0dXJuICh2YWxJbnQgJSBzdGVwSW50KSAvIDEwICoqIGRlY0NvdW50O1xufVxuZXhwb3J0IGNsYXNzIFpvZE51bWJlciBleHRlbmRzIFpvZFR5cGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICB0aGlzLm1pbiA9IHRoaXMuZ3RlO1xuICAgICAgICB0aGlzLm1heCA9IHRoaXMubHRlO1xuICAgICAgICB0aGlzLnN0ZXAgPSB0aGlzLm11bHRpcGxlT2Y7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBpZiAodGhpcy5fZGVmLmNvZXJjZSkge1xuICAgICAgICAgICAgaW5wdXQuZGF0YSA9IE51bWJlcihpbnB1dC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm51bWJlcikge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5udW1iZXIsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgY3R4ID0gdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBzdGF0dXMgPSBuZXcgUGFyc2VTdGF0dXMoKTtcbiAgICAgICAgZm9yIChjb25zdCBjaGVjayBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2hlY2sua2luZCA9PT0gXCJpbnRcIikge1xuICAgICAgICAgICAgICAgIGlmICghdXRpbC5pc0ludGVnZXIoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBcImludGVnZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBcImZsb2F0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2hlY2sua2luZCA9PT0gXCJtaW5cIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb1NtYWxsID0gY2hlY2suaW5jbHVzaXZlID8gaW5wdXQuZGF0YSA8IGNoZWNrLnZhbHVlIDogaW5wdXQuZGF0YSA8PSBjaGVjay52YWx1ZTtcbiAgICAgICAgICAgICAgICBpZiAodG9vU21hbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19zbWFsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbmltdW06IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJudW1iZXJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogY2hlY2suaW5jbHVzaXZlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29CaWcgPSBjaGVjay5pbmNsdXNpdmUgPyBpbnB1dC5kYXRhID4gY2hlY2sudmFsdWUgOiBpbnB1dC5kYXRhID49IGNoZWNrLnZhbHVlO1xuICAgICAgICAgICAgICAgIGlmICh0b29CaWcpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19iaWcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhpbXVtOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwibnVtYmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IGNoZWNrLmluY2x1c2l2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcIm11bHRpcGxlT2ZcIikge1xuICAgICAgICAgICAgICAgIGlmIChmbG9hdFNhZmVSZW1haW5kZXIoaW5wdXQuZGF0YSwgY2hlY2sudmFsdWUpICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0LCBjdHgpO1xuICAgICAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5ub3RfbXVsdGlwbGVfb2YsXG4gICAgICAgICAgICAgICAgICAgICAgICBtdWx0aXBsZU9mOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcImZpbml0ZVwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLm5vdF9maW5pdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXRpbC5hc3NlcnROZXZlcihjaGVjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiBzdGF0dXMudmFsdWUsIHZhbHVlOiBpbnB1dC5kYXRhIH07XG4gICAgfVxuICAgIGd0ZSh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRMaW1pdChcIm1pblwiLCB2YWx1ZSwgdHJ1ZSwgZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgZ3QodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGltaXQoXCJtaW5cIiwgdmFsdWUsIGZhbHNlLCBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkpO1xuICAgIH1cbiAgICBsdGUodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGltaXQoXCJtYXhcIiwgdmFsdWUsIHRydWUsIGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSk7XG4gICAgfVxuICAgIGx0KHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldExpbWl0KFwibWF4XCIsIHZhbHVlLCBmYWxzZSwgZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgc2V0TGltaXQoa2luZCwgdmFsdWUsIGluY2x1c2l2ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZE51bWJlcih7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjaGVja3M6IFtcbiAgICAgICAgICAgICAgICAuLi50aGlzLl9kZWYuY2hlY2tzLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAga2luZCxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgX2FkZENoZWNrKGNoZWNrKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kTnVtYmVyKHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogWy4uLnRoaXMuX2RlZi5jaGVja3MsIGNoZWNrXSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGludChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcImludFwiLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcG9zaXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtaW5cIixcbiAgICAgICAgICAgIHZhbHVlOiAwLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiBmYWxzZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG5lZ2F0aXZlKG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWF4XCIsXG4gICAgICAgICAgICB2YWx1ZTogMCxcbiAgICAgICAgICAgIGluY2x1c2l2ZTogZmFsc2UsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBub25wb3NpdGl2ZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1heFwiLFxuICAgICAgICAgICAgdmFsdWU6IDAsXG4gICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBub25uZWdhdGl2ZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1pblwiLFxuICAgICAgICAgICAgdmFsdWU6IDAsXG4gICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBtdWx0aXBsZU9mKHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm11bHRpcGxlT2ZcIixcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGZpbml0ZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcImZpbml0ZVwiLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgc2FmZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1pblwiLFxuICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IE51bWJlci5NSU5fU0FGRV9JTlRFR0VSLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KS5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtYXhcIixcbiAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUixcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGdldCBtaW5WYWx1ZSgpIHtcbiAgICAgICAgbGV0IG1pbiA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWluID09PSBudWxsIHx8IGNoLnZhbHVlID4gbWluKVxuICAgICAgICAgICAgICAgICAgICBtaW4gPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWluO1xuICAgIH1cbiAgICBnZXQgbWF4VmFsdWUoKSB7XG4gICAgICAgIGxldCBtYXggPSBudWxsO1xuICAgICAgICBmb3IgKGNvbnN0IGNoIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaC5raW5kID09PSBcIm1heFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1heCA9PT0gbnVsbCB8fCBjaC52YWx1ZSA8IG1heClcbiAgICAgICAgICAgICAgICAgICAgbWF4ID0gY2gudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heDtcbiAgICB9XG4gICAgZ2V0IGlzSW50KCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9kZWYuY2hlY2tzLmZpbmQoKGNoKSA9PiBjaC5raW5kID09PSBcImludFwiIHx8IChjaC5raW5kID09PSBcIm11bHRpcGxlT2ZcIiAmJiB1dGlsLmlzSW50ZWdlcihjaC52YWx1ZSkpKTtcbiAgICB9XG4gICAgZ2V0IGlzRmluaXRlKCkge1xuICAgICAgICBsZXQgbWF4ID0gbnVsbDtcbiAgICAgICAgbGV0IG1pbiA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwiZmluaXRlXCIgfHwgY2gua2luZCA9PT0gXCJpbnRcIiB8fCBjaC5raW5kID09PSBcIm11bHRpcGxlT2ZcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2gua2luZCA9PT0gXCJtaW5cIikge1xuICAgICAgICAgICAgICAgIGlmIChtaW4gPT09IG51bGwgfHwgY2gudmFsdWUgPiBtaW4pXG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY2gua2luZCA9PT0gXCJtYXhcIikge1xuICAgICAgICAgICAgICAgIGlmIChtYXggPT09IG51bGwgfHwgY2gudmFsdWUgPCBtYXgpXG4gICAgICAgICAgICAgICAgICAgIG1heCA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBOdW1iZXIuaXNGaW5pdGUobWluKSAmJiBOdW1iZXIuaXNGaW5pdGUobWF4KTtcbiAgICB9XG59XG5ab2ROdW1iZXIuY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTnVtYmVyKHtcbiAgICAgICAgY2hlY2tzOiBbXSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2ROdW1iZXIsXG4gICAgICAgIGNvZXJjZTogcGFyYW1zPy5jb2VyY2UgfHwgZmFsc2UsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kQmlnSW50IGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMubWluID0gdGhpcy5ndGU7XG4gICAgICAgIHRoaXMubWF4ID0gdGhpcy5sdGU7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBpZiAodGhpcy5fZGVmLmNvZXJjZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpbnB1dC5kYXRhID0gQmlnSW50KGlucHV0LmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXRJbnZhbGlkSW5wdXQoaW5wdXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuYmlnaW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0SW52YWxpZElucHV0KGlucHV0KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgY3R4ID0gdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBzdGF0dXMgPSBuZXcgUGFyc2VTdGF0dXMoKTtcbiAgICAgICAgZm9yIChjb25zdCBjaGVjayBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2hlY2sua2luZCA9PT0gXCJtaW5cIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb1NtYWxsID0gY2hlY2suaW5jbHVzaXZlID8gaW5wdXQuZGF0YSA8IGNoZWNrLnZhbHVlIDogaW5wdXQuZGF0YSA8PSBjaGVjay52YWx1ZTtcbiAgICAgICAgICAgICAgICBpZiAodG9vU21hbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19zbWFsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiYmlnaW50XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiBjaGVjay52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogY2hlY2suaW5jbHVzaXZlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29CaWcgPSBjaGVjay5pbmNsdXNpdmUgPyBpbnB1dC5kYXRhID4gY2hlY2sudmFsdWUgOiBpbnB1dC5kYXRhID49IGNoZWNrLnZhbHVlO1xuICAgICAgICAgICAgICAgIGlmICh0b29CaWcpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19iaWcsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImJpZ2ludFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IGNoZWNrLmluY2x1c2l2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNoZWNrLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcIm11bHRpcGxlT2ZcIikge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5kYXRhICUgY2hlY2sudmFsdWUgIT09IEJpZ0ludCgwKSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUubm90X211bHRpcGxlX29mLFxuICAgICAgICAgICAgICAgICAgICAgICAgbXVsdGlwbGVPZjogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXRpbC5hc3NlcnROZXZlcihjaGVjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiBzdGF0dXMudmFsdWUsIHZhbHVlOiBpbnB1dC5kYXRhIH07XG4gICAgfVxuICAgIF9nZXRJbnZhbGlkSW5wdXQoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5iaWdpbnQsXG4gICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICB9XG4gICAgZ3RlKHZhbHVlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldExpbWl0KFwibWluXCIsIHZhbHVlLCB0cnVlLCBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkpO1xuICAgIH1cbiAgICBndCh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRMaW1pdChcIm1pblwiLCB2YWx1ZSwgZmFsc2UsIGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSk7XG4gICAgfVxuICAgIGx0ZSh2YWx1ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRMaW1pdChcIm1heFwiLCB2YWx1ZSwgdHJ1ZSwgZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpKTtcbiAgICB9XG4gICAgbHQodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGltaXQoXCJtYXhcIiwgdmFsdWUsIGZhbHNlLCBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkpO1xuICAgIH1cbiAgICBzZXRMaW1pdChraW5kLCB2YWx1ZSwgaW5jbHVzaXZlLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kQmlnSW50KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGNoZWNrczogW1xuICAgICAgICAgICAgICAgIC4uLnRoaXMuX2RlZi5jaGVja3MsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBraW5kLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBfYWRkQ2hlY2soY2hlY2spIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RCaWdJbnQoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgY2hlY2tzOiBbLi4udGhpcy5fZGVmLmNoZWNrcywgY2hlY2tdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcG9zaXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtaW5cIixcbiAgICAgICAgICAgIHZhbHVlOiBCaWdJbnQoMCksXG4gICAgICAgICAgICBpbmNsdXNpdmU6IGZhbHNlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbmVnYXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtYXhcIixcbiAgICAgICAgICAgIHZhbHVlOiBCaWdJbnQoMCksXG4gICAgICAgICAgICBpbmNsdXNpdmU6IGZhbHNlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbm9ucG9zaXRpdmUobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtYXhcIixcbiAgICAgICAgICAgIHZhbHVlOiBCaWdJbnQoMCksXG4gICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBub25uZWdhdGl2ZShtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRDaGVjayh7XG4gICAgICAgICAgICBraW5kOiBcIm1pblwiLFxuICAgICAgICAgICAgdmFsdWU6IEJpZ0ludCgwKSxcbiAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG11bHRpcGxlT2YodmFsdWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibXVsdGlwbGVPZlwiLFxuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBnZXQgbWluVmFsdWUoKSB7XG4gICAgICAgIGxldCBtaW4gPSBudWxsO1xuICAgICAgICBmb3IgKGNvbnN0IGNoIG9mIHRoaXMuX2RlZi5jaGVja3MpIHtcbiAgICAgICAgICAgIGlmIChjaC5raW5kID09PSBcIm1pblwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1pbiA9PT0gbnVsbCB8fCBjaC52YWx1ZSA+IG1pbilcbiAgICAgICAgICAgICAgICAgICAgbWluID0gY2gudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1pbjtcbiAgICB9XG4gICAgZ2V0IG1heFZhbHVlKCkge1xuICAgICAgICBsZXQgbWF4ID0gbnVsbDtcbiAgICAgICAgZm9yIChjb25zdCBjaCBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2gua2luZCA9PT0gXCJtYXhcIikge1xuICAgICAgICAgICAgICAgIGlmIChtYXggPT09IG51bGwgfHwgY2gudmFsdWUgPCBtYXgpXG4gICAgICAgICAgICAgICAgICAgIG1heCA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXg7XG4gICAgfVxufVxuWm9kQmlnSW50LmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZEJpZ0ludCh7XG4gICAgICAgIGNoZWNrczogW10sXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kQmlnSW50LFxuICAgICAgICBjb2VyY2U6IHBhcmFtcz8uY29lcmNlID8/IGZhbHNlLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZEJvb2xlYW4gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RlZi5jb2VyY2UpIHtcbiAgICAgICAgICAgIGlucHV0LmRhdGEgPSBCb29sZWFuKGlucHV0LmRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuYm9vbGVhbikge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5ib29sZWFuLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9LKGlucHV0LmRhdGEpO1xuICAgIH1cbn1cblpvZEJvb2xlYW4uY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kQm9vbGVhbih7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kQm9vbGVhbixcbiAgICAgICAgY29lcmNlOiBwYXJhbXM/LmNvZXJjZSB8fCBmYWxzZSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2REYXRlIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGlmICh0aGlzLl9kZWYuY29lcmNlKSB7XG4gICAgICAgICAgICBpbnB1dC5kYXRhID0gbmV3IERhdGUoaW5wdXQuZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5kYXRlKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLmRhdGUsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoTnVtYmVyLmlzTmFOKGlucHV0LmRhdGEuZ2V0VGltZSgpKSkge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfZGF0ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhdHVzID0gbmV3IFBhcnNlU3RhdHVzKCk7XG4gICAgICAgIGxldCBjdHggPSB1bmRlZmluZWQ7XG4gICAgICAgIGZvciAoY29uc3QgY2hlY2sgb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoZWNrLmtpbmQgPT09IFwibWluXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuZGF0YS5nZXRUaW1lKCkgPCBjaGVjay52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCwgY3R4KTtcbiAgICAgICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX3NtYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY2hlY2subWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbmltdW06IGNoZWNrLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJkYXRlXCIsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjaGVjay5raW5kID09PSBcIm1heFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LmRhdGEuZ2V0VGltZSgpID4gY2hlY2sudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQsIGN0eCk7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19iaWcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjaGVjay5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVzaXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogY2hlY2sudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImRhdGVcIixcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHV0aWwuYXNzZXJ0TmV2ZXIoY2hlY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXM6IHN0YXR1cy52YWx1ZSxcbiAgICAgICAgICAgIHZhbHVlOiBuZXcgRGF0ZShpbnB1dC5kYXRhLmdldFRpbWUoKSksXG4gICAgICAgIH07XG4gICAgfVxuICAgIF9hZGRDaGVjayhjaGVjaykge1xuICAgICAgICByZXR1cm4gbmV3IFpvZERhdGUoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgY2hlY2tzOiBbLi4udGhpcy5fZGVmLmNoZWNrcywgY2hlY2tdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbWluKG1pbkRhdGUsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZENoZWNrKHtcbiAgICAgICAgICAgIGtpbmQ6IFwibWluXCIsXG4gICAgICAgICAgICB2YWx1ZTogbWluRGF0ZS5nZXRUaW1lKCksXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBtYXgobWF4RGF0ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkQ2hlY2soe1xuICAgICAgICAgICAga2luZDogXCJtYXhcIixcbiAgICAgICAgICAgIHZhbHVlOiBtYXhEYXRlLmdldFRpbWUoKSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGdldCBtaW5EYXRlKCkge1xuICAgICAgICBsZXQgbWluID0gbnVsbDtcbiAgICAgICAgZm9yIChjb25zdCBjaCBvZiB0aGlzLl9kZWYuY2hlY2tzKSB7XG4gICAgICAgICAgICBpZiAoY2gua2luZCA9PT0gXCJtaW5cIikge1xuICAgICAgICAgICAgICAgIGlmIChtaW4gPT09IG51bGwgfHwgY2gudmFsdWUgPiBtaW4pXG4gICAgICAgICAgICAgICAgICAgIG1pbiA9IGNoLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtaW4gIT0gbnVsbCA/IG5ldyBEYXRlKG1pbikgOiBudWxsO1xuICAgIH1cbiAgICBnZXQgbWF4RGF0ZSgpIHtcbiAgICAgICAgbGV0IG1heCA9IG51bGw7XG4gICAgICAgIGZvciAoY29uc3QgY2ggb2YgdGhpcy5fZGVmLmNoZWNrcykge1xuICAgICAgICAgICAgaWYgKGNoLmtpbmQgPT09IFwibWF4XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWF4ID09PSBudWxsIHx8IGNoLnZhbHVlIDwgbWF4KVxuICAgICAgICAgICAgICAgICAgICBtYXggPSBjaC52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF4ICE9IG51bGwgPyBuZXcgRGF0ZShtYXgpIDogbnVsbDtcbiAgICB9XG59XG5ab2REYXRlLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZERhdGUoe1xuICAgICAgICBjaGVja3M6IFtdLFxuICAgICAgICBjb2VyY2U6IHBhcmFtcz8uY29lcmNlIHx8IGZhbHNlLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZERhdGUsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kU3ltYm9sIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUuc3ltYm9sKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLnN5bWJvbCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBPSyhpbnB1dC5kYXRhKTtcbiAgICB9XG59XG5ab2RTeW1ib2wuY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kU3ltYm9sKHtcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RTeW1ib2wsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kVW5kZWZpbmVkIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUudW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLnVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBPSyhpbnB1dC5kYXRhKTtcbiAgICB9XG59XG5ab2RVbmRlZmluZWQuY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kVW5kZWZpbmVkKHtcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RVbmRlZmluZWQsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kTnVsbCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUubnVsbCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBPSyhpbnB1dC5kYXRhKTtcbiAgICB9XG59XG5ab2ROdWxsLmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE51bGwoe1xuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE51bGwsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kQW55IGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIC8vIHRvIHByZXZlbnQgaW5zdGFuY2VzIG9mIG90aGVyIGNsYXNzZXMgZnJvbSBleHRlbmRpbmcgWm9kQW55LiB0aGlzIGNhdXNlcyBpc3N1ZXMgd2l0aCBjYXRjaGFsbCBpbiBab2RPYmplY3QuXG4gICAgICAgIHRoaXMuX2FueSA9IHRydWU7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxufVxuWm9kQW55LmNyZWF0ZSA9IChwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZEFueSh7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kQW55LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZFVua25vd24gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgLy8gcmVxdWlyZWRcbiAgICAgICAgdGhpcy5fdW5rbm93biA9IHRydWU7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxufVxuWm9kVW5rbm93bi5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RVbmtub3duKHtcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RVbmtub3duLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZE5ldmVyIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUubmV2ZXIsXG4gICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICB9XG59XG5ab2ROZXZlci5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2ROZXZlcih7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kTmV2ZXIsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kVm9pZCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBwYXJzZWRUeXBlID0gdGhpcy5fZ2V0VHlwZShpbnB1dCk7XG4gICAgICAgIGlmIChwYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLnVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5fZ2V0T3JSZXR1cm5DdHgoaW5wdXQpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS52b2lkLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9LKGlucHV0LmRhdGEpO1xuICAgIH1cbn1cblpvZFZvaWQuY3JlYXRlID0gKHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kVm9pZCh7XG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kVm9pZCxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RBcnJheSBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IGN0eCwgc3RhdHVzIH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBjb25zdCBkZWYgPSB0aGlzLl9kZWY7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5hcnJheSkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5hcnJheSxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkZWYuZXhhY3RMZW5ndGggIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvb0JpZyA9IGN0eC5kYXRhLmxlbmd0aCA+IGRlZi5leGFjdExlbmd0aC52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IHRvb1NtYWxsID0gY3R4LmRhdGEubGVuZ3RoIDwgZGVmLmV4YWN0TGVuZ3RoLnZhbHVlO1xuICAgICAgICAgICAgaWYgKHRvb0JpZyB8fCB0b29TbWFsbCkge1xuICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiB0b29CaWcgPyBab2RJc3N1ZUNvZGUudG9vX2JpZyA6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgICAgIG1pbmltdW06ICh0b29TbWFsbCA/IGRlZi5leGFjdExlbmd0aC52YWx1ZSA6IHVuZGVmaW5lZCksXG4gICAgICAgICAgICAgICAgICAgIG1heGltdW06ICh0b29CaWcgPyBkZWYuZXhhY3RMZW5ndGgudmFsdWUgOiB1bmRlZmluZWQpLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGRlZi5leGFjdExlbmd0aC5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkZWYubWluTGVuZ3RoICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoY3R4LmRhdGEubGVuZ3RoIDwgZGVmLm1pbkxlbmd0aC52YWx1ZSkge1xuICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX3NtYWxsLFxuICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiBkZWYubWluTGVuZ3RoLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBkZWYubWluTGVuZ3RoLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlZi5tYXhMZW5ndGggIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChjdHguZGF0YS5sZW5ndGggPiBkZWYubWF4TGVuZ3RoLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fYmlnLFxuICAgICAgICAgICAgICAgICAgICBtYXhpbXVtOiBkZWYubWF4TGVuZ3RoLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImFycmF5XCIsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBkZWYubWF4TGVuZ3RoLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbLi4uY3R4LmRhdGFdLm1hcCgoaXRlbSwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWYudHlwZS5fcGFyc2VBc3luYyhuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgaXRlbSwgY3R4LnBhdGgsIGkpKTtcbiAgICAgICAgICAgIH0pKS50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VBcnJheShzdGF0dXMsIHJlc3VsdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBbLi4uY3R4LmRhdGFdLm1hcCgoaXRlbSwgaSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGRlZi50eXBlLl9wYXJzZVN5bmMobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIGl0ZW0sIGN0eC5wYXRoLCBpKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VBcnJheShzdGF0dXMsIHJlc3VsdCk7XG4gICAgfVxuICAgIGdldCBlbGVtZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnR5cGU7XG4gICAgfVxuICAgIG1pbihtaW5MZW5ndGgsIG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RBcnJheSh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBtaW5MZW5ndGg6IHsgdmFsdWU6IG1pbkxlbmd0aCwgbWVzc2FnZTogZXJyb3JVdGlsLnRvU3RyaW5nKG1lc3NhZ2UpIH0sXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBtYXgobWF4TGVuZ3RoLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kQXJyYXkoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgbWF4TGVuZ3RoOiB7IHZhbHVlOiBtYXhMZW5ndGgsIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbGVuZ3RoKGxlbiwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZEFycmF5KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIGV4YWN0TGVuZ3RoOiB7IHZhbHVlOiBsZW4sIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgbm9uZW1wdHkobWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5taW4oMSwgbWVzc2FnZSk7XG4gICAgfVxufVxuWm9kQXJyYXkuY3JlYXRlID0gKHNjaGVtYSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RBcnJheSh7XG4gICAgICAgIHR5cGU6IHNjaGVtYSxcbiAgICAgICAgbWluTGVuZ3RoOiBudWxsLFxuICAgICAgICBtYXhMZW5ndGg6IG51bGwsXG4gICAgICAgIGV4YWN0TGVuZ3RoOiBudWxsLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEFycmF5LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZnVuY3Rpb24gZGVlcFBhcnRpYWxpZnkoc2NoZW1hKSB7XG4gICAgaWYgKHNjaGVtYSBpbnN0YW5jZW9mIFpvZE9iamVjdCkge1xuICAgICAgICBjb25zdCBuZXdTaGFwZSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBzY2hlbWEuc2hhcGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpZWxkU2NoZW1hID0gc2NoZW1hLnNoYXBlW2tleV07XG4gICAgICAgICAgICBuZXdTaGFwZVtrZXldID0gWm9kT3B0aW9uYWwuY3JlYXRlKGRlZXBQYXJ0aWFsaWZ5KGZpZWxkU2NoZW1hKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBab2RPYmplY3Qoe1xuICAgICAgICAgICAgLi4uc2NoZW1hLl9kZWYsXG4gICAgICAgICAgICBzaGFwZTogKCkgPT4gbmV3U2hhcGUsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIGlmIChzY2hlbWEgaW5zdGFuY2VvZiBab2RBcnJheSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZEFycmF5KHtcbiAgICAgICAgICAgIC4uLnNjaGVtYS5fZGVmLFxuICAgICAgICAgICAgdHlwZTogZGVlcFBhcnRpYWxpZnkoc2NoZW1hLmVsZW1lbnQpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSBpZiAoc2NoZW1hIGluc3RhbmNlb2YgWm9kT3B0aW9uYWwpIHtcbiAgICAgICAgcmV0dXJuIFpvZE9wdGlvbmFsLmNyZWF0ZShkZWVwUGFydGlhbGlmeShzY2hlbWEudW53cmFwKCkpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoc2NoZW1hIGluc3RhbmNlb2YgWm9kTnVsbGFibGUpIHtcbiAgICAgICAgcmV0dXJuIFpvZE51bGxhYmxlLmNyZWF0ZShkZWVwUGFydGlhbGlmeShzY2hlbWEudW53cmFwKCkpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoc2NoZW1hIGluc3RhbmNlb2YgWm9kVHVwbGUpIHtcbiAgICAgICAgcmV0dXJuIFpvZFR1cGxlLmNyZWF0ZShzY2hlbWEuaXRlbXMubWFwKChpdGVtKSA9PiBkZWVwUGFydGlhbGlmeShpdGVtKSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHNjaGVtYTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgWm9kT2JqZWN0IGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuX2NhY2hlZCA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZGVwcmVjYXRlZCBJbiBtb3N0IGNhc2VzLCB0aGlzIGlzIG5vIGxvbmdlciBuZWVkZWQgLSB1bmtub3duIHByb3BlcnRpZXMgYXJlIG5vdyBzaWxlbnRseSBzdHJpcHBlZC5cbiAgICAgICAgICogSWYgeW91IHdhbnQgdG8gcGFzcyB0aHJvdWdoIHVua25vd24gcHJvcGVydGllcywgdXNlIGAucGFzc3Rocm91Z2goKWAgaW5zdGVhZC5cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9uc3RyaWN0ID0gdGhpcy5wYXNzdGhyb3VnaDtcbiAgICAgICAgLy8gZXh0ZW5kPFxuICAgICAgICAvLyAgIEF1Z21lbnRhdGlvbiBleHRlbmRzIFpvZFJhd1NoYXBlLFxuICAgICAgICAvLyAgIE5ld091dHB1dCBleHRlbmRzIHV0aWwuZmxhdHRlbjx7XG4gICAgICAgIC8vICAgICBbayBpbiBrZXlvZiBBdWdtZW50YXRpb24gfCBrZXlvZiBPdXRwdXRdOiBrIGV4dGVuZHMga2V5b2YgQXVnbWVudGF0aW9uXG4gICAgICAgIC8vICAgICAgID8gQXVnbWVudGF0aW9uW2tdW1wiX291dHB1dFwiXVxuICAgICAgICAvLyAgICAgICA6IGsgZXh0ZW5kcyBrZXlvZiBPdXRwdXRcbiAgICAgICAgLy8gICAgICAgPyBPdXRwdXRba11cbiAgICAgICAgLy8gICAgICAgOiBuZXZlcjtcbiAgICAgICAgLy8gICB9PixcbiAgICAgICAgLy8gICBOZXdJbnB1dCBleHRlbmRzIHV0aWwuZmxhdHRlbjx7XG4gICAgICAgIC8vICAgICBbayBpbiBrZXlvZiBBdWdtZW50YXRpb24gfCBrZXlvZiBJbnB1dF06IGsgZXh0ZW5kcyBrZXlvZiBBdWdtZW50YXRpb25cbiAgICAgICAgLy8gICAgICAgPyBBdWdtZW50YXRpb25ba11bXCJfaW5wdXRcIl1cbiAgICAgICAgLy8gICAgICAgOiBrIGV4dGVuZHMga2V5b2YgSW5wdXRcbiAgICAgICAgLy8gICAgICAgPyBJbnB1dFtrXVxuICAgICAgICAvLyAgICAgICA6IG5ldmVyO1xuICAgICAgICAvLyAgIH0+XG4gICAgICAgIC8vID4oXG4gICAgICAgIC8vICAgYXVnbWVudGF0aW9uOiBBdWdtZW50YXRpb25cbiAgICAgICAgLy8gKTogWm9kT2JqZWN0PFxuICAgICAgICAvLyAgIGV4dGVuZFNoYXBlPFQsIEF1Z21lbnRhdGlvbj4sXG4gICAgICAgIC8vICAgVW5rbm93bktleXMsXG4gICAgICAgIC8vICAgQ2F0Y2hhbGwsXG4gICAgICAgIC8vICAgTmV3T3V0cHV0LFxuICAgICAgICAvLyAgIE5ld0lucHV0XG4gICAgICAgIC8vID4ge1xuICAgICAgICAvLyAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgLy8gICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgLy8gICAgIHNoYXBlOiAoKSA9PiAoe1xuICAgICAgICAvLyAgICAgICAuLi50aGlzLl9kZWYuc2hhcGUoKSxcbiAgICAgICAgLy8gICAgICAgLi4uYXVnbWVudGF0aW9uLFxuICAgICAgICAvLyAgICAgfSksXG4gICAgICAgIC8vICAgfSkgYXMgYW55O1xuICAgICAgICAvLyB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZGVwcmVjYXRlZCBVc2UgYC5leHRlbmRgIGluc3RlYWRcbiAgICAgICAgICogICovXG4gICAgICAgIHRoaXMuYXVnbWVudCA9IHRoaXMuZXh0ZW5kO1xuICAgIH1cbiAgICBfZ2V0Q2FjaGVkKCkge1xuICAgICAgICBpZiAodGhpcy5fY2FjaGVkICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZDtcbiAgICAgICAgY29uc3Qgc2hhcGUgPSB0aGlzLl9kZWYuc2hhcGUoKTtcbiAgICAgICAgY29uc3Qga2V5cyA9IHV0aWwub2JqZWN0S2V5cyhzaGFwZSk7XG4gICAgICAgIHRoaXMuX2NhY2hlZCA9IHsgc2hhcGUsIGtleXMgfTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZDtcbiAgICB9XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUub2JqZWN0KSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLm9iamVjdCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzLCBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGNvbnN0IHsgc2hhcGUsIGtleXM6IHNoYXBlS2V5cyB9ID0gdGhpcy5fZ2V0Q2FjaGVkKCk7XG4gICAgICAgIGNvbnN0IGV4dHJhS2V5cyA9IFtdO1xuICAgICAgICBpZiAoISh0aGlzLl9kZWYuY2F0Y2hhbGwgaW5zdGFuY2VvZiBab2ROZXZlciAmJiB0aGlzLl9kZWYudW5rbm93bktleXMgPT09IFwic3RyaXBcIikpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGN0eC5kYXRhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaGFwZUtleXMuaW5jbHVkZXMoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBleHRyYUtleXMucHVzaChrZXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYWlycyA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBzaGFwZUtleXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGtleVZhbGlkYXRvciA9IHNoYXBlW2tleV07XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGN0eC5kYXRhW2tleV07XG4gICAgICAgICAgICBwYWlycy5wdXNoKHtcbiAgICAgICAgICAgICAgICBrZXk6IHsgc3RhdHVzOiBcInZhbGlkXCIsIHZhbHVlOiBrZXkgfSxcbiAgICAgICAgICAgICAgICB2YWx1ZToga2V5VmFsaWRhdG9yLl9wYXJzZShuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgdmFsdWUsIGN0eC5wYXRoLCBrZXkpKSxcbiAgICAgICAgICAgICAgICBhbHdheXNTZXQ6IGtleSBpbiBjdHguZGF0YSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9kZWYuY2F0Y2hhbGwgaW5zdGFuY2VvZiBab2ROZXZlcikge1xuICAgICAgICAgICAgY29uc3QgdW5rbm93bktleXMgPSB0aGlzLl9kZWYudW5rbm93bktleXM7XG4gICAgICAgICAgICBpZiAodW5rbm93bktleXMgPT09IFwicGFzc3Rocm91Z2hcIikge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IG9mIGV4dHJhS2V5cykge1xuICAgICAgICAgICAgICAgICAgICBwYWlycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogeyBzdGF0dXM6IFwidmFsaWRcIiwgdmFsdWU6IGtleSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHsgc3RhdHVzOiBcInZhbGlkXCIsIHZhbHVlOiBjdHguZGF0YVtrZXldIH0sXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHVua25vd25LZXlzID09PSBcInN0cmljdFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV4dHJhS2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnVucmVjb2duaXplZF9rZXlzLFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5czogZXh0cmFLZXlzLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodW5rbm93bktleXMgPT09IFwic3RyaXBcIikge1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBab2RPYmplY3QgZXJyb3I6IGludmFsaWQgdW5rbm93bktleXMgdmFsdWUuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBydW4gY2F0Y2hhbGwgdmFsaWRhdGlvblxuICAgICAgICAgICAgY29uc3QgY2F0Y2hhbGwgPSB0aGlzLl9kZWYuY2F0Y2hhbGw7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBleHRyYUtleXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGN0eC5kYXRhW2tleV07XG4gICAgICAgICAgICAgICAgcGFpcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGtleTogeyBzdGF0dXM6IFwidmFsaWRcIiwgdmFsdWU6IGtleSB9LFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogY2F0Y2hhbGwuX3BhcnNlKG5ldyBQYXJzZUlucHV0TGF6eVBhdGgoY3R4LCB2YWx1ZSwgY3R4LnBhdGgsIGtleSkgLy8sIGN0eC5jaGlsZChrZXkpLCB2YWx1ZSwgZ2V0UGFyc2VkVHlwZSh2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgYWx3YXlzU2V0OiBrZXkgaW4gY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgICAgIC50aGVuKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzeW5jUGFpcnMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBhaXIgb2YgcGFpcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gYXdhaXQgcGFpci5rZXk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgcGFpci52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgc3luY1BhaXJzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhbHdheXNTZXQ6IHBhaXIuYWx3YXlzU2V0LFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN5bmNQYWlycztcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4oKHN5bmNQYWlycykgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBQYXJzZVN0YXR1cy5tZXJnZU9iamVjdFN5bmMoc3RhdHVzLCBzeW5jUGFpcnMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VPYmplY3RTeW5jKHN0YXR1cywgcGFpcnMpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGdldCBzaGFwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5zaGFwZSgpO1xuICAgIH1cbiAgICBzdHJpY3QobWVzc2FnZSkge1xuICAgICAgICBlcnJvclV0aWwuZXJyVG9PYmo7XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHVua25vd25LZXlzOiBcInN0cmljdFwiLFxuICAgICAgICAgICAgLi4uKG1lc3NhZ2UgIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgICAgICBlcnJvck1hcDogKGlzc3VlLCBjdHgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRFcnJvciA9IHRoaXMuX2RlZi5lcnJvck1hcD8uKGlzc3VlLCBjdHgpLm1lc3NhZ2UgPz8gY3R4LmRlZmF1bHRFcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc3N1ZS5jb2RlID09PSBcInVucmVjb2duaXplZF9rZXlzXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyb3JVdGlsLmVyclRvT2JqKG1lc3NhZ2UpLm1lc3NhZ2UgPz8gZGVmYXVsdEVycm9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGRlZmF1bHRFcnJvcixcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIDoge30pLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgc3RyaXAoKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHVua25vd25LZXlzOiBcInN0cmlwXCIsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBwYXNzdGhyb3VnaCgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RPYmplY3Qoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgdW5rbm93bktleXM6IFwicGFzc3Rocm91Z2hcIixcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIGNvbnN0IEF1Z21lbnRGYWN0b3J5ID1cbiAgICAvLyAgIDxEZWYgZXh0ZW5kcyBab2RPYmplY3REZWY+KGRlZjogRGVmKSA9PlxuICAgIC8vICAgPEF1Z21lbnRhdGlvbiBleHRlbmRzIFpvZFJhd1NoYXBlPihcbiAgICAvLyAgICAgYXVnbWVudGF0aW9uOiBBdWdtZW50YXRpb25cbiAgICAvLyAgICk6IFpvZE9iamVjdDxcbiAgICAvLyAgICAgZXh0ZW5kU2hhcGU8UmV0dXJuVHlwZTxEZWZbXCJzaGFwZVwiXT4sIEF1Z21lbnRhdGlvbj4sXG4gICAgLy8gICAgIERlZltcInVua25vd25LZXlzXCJdLFxuICAgIC8vICAgICBEZWZbXCJjYXRjaGFsbFwiXVxuICAgIC8vICAgPiA9PiB7XG4gICAgLy8gICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAvLyAgICAgICAuLi5kZWYsXG4gICAgLy8gICAgICAgc2hhcGU6ICgpID0+ICh7XG4gICAgLy8gICAgICAgICAuLi5kZWYuc2hhcGUoKSxcbiAgICAvLyAgICAgICAgIC4uLmF1Z21lbnRhdGlvbixcbiAgICAvLyAgICAgICB9KSxcbiAgICAvLyAgICAgfSkgYXMgYW55O1xuICAgIC8vICAgfTtcbiAgICBleHRlbmQoYXVnbWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHNoYXBlOiAoKSA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLnRoaXMuX2RlZi5zaGFwZSgpLFxuICAgICAgICAgICAgICAgIC4uLmF1Z21lbnRhdGlvbixcbiAgICAgICAgICAgIH0pLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUHJpb3IgdG8gem9kQDEuMC4xMiB0aGVyZSB3YXMgYSBidWcgaW4gdGhlXG4gICAgICogaW5mZXJyZWQgdHlwZSBvZiBtZXJnZWQgb2JqZWN0cy4gUGxlYXNlXG4gICAgICogdXBncmFkZSBpZiB5b3UgYXJlIGV4cGVyaWVuY2luZyBpc3N1ZXMuXG4gICAgICovXG4gICAgbWVyZ2UobWVyZ2luZykge1xuICAgICAgICBjb25zdCBtZXJnZWQgPSBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIHVua25vd25LZXlzOiBtZXJnaW5nLl9kZWYudW5rbm93bktleXMsXG4gICAgICAgICAgICBjYXRjaGFsbDogbWVyZ2luZy5fZGVmLmNhdGNoYWxsLFxuICAgICAgICAgICAgc2hhcGU6ICgpID0+ICh7XG4gICAgICAgICAgICAgICAgLi4udGhpcy5fZGVmLnNoYXBlKCksXG4gICAgICAgICAgICAgICAgLi4ubWVyZ2luZy5fZGVmLnNoYXBlKCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT2JqZWN0LFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG1lcmdlZDtcbiAgICB9XG4gICAgLy8gbWVyZ2U8XG4gICAgLy8gICBJbmNvbWluZyBleHRlbmRzIEFueVpvZE9iamVjdCxcbiAgICAvLyAgIEF1Z21lbnRhdGlvbiBleHRlbmRzIEluY29taW5nW1wic2hhcGVcIl0sXG4gICAgLy8gICBOZXdPdXRwdXQgZXh0ZW5kcyB7XG4gICAgLy8gICAgIFtrIGluIGtleW9mIEF1Z21lbnRhdGlvbiB8IGtleW9mIE91dHB1dF06IGsgZXh0ZW5kcyBrZXlvZiBBdWdtZW50YXRpb25cbiAgICAvLyAgICAgICA/IEF1Z21lbnRhdGlvbltrXVtcIl9vdXRwdXRcIl1cbiAgICAvLyAgICAgICA6IGsgZXh0ZW5kcyBrZXlvZiBPdXRwdXRcbiAgICAvLyAgICAgICA/IE91dHB1dFtrXVxuICAgIC8vICAgICAgIDogbmV2ZXI7XG4gICAgLy8gICB9LFxuICAgIC8vICAgTmV3SW5wdXQgZXh0ZW5kcyB7XG4gICAgLy8gICAgIFtrIGluIGtleW9mIEF1Z21lbnRhdGlvbiB8IGtleW9mIElucHV0XTogayBleHRlbmRzIGtleW9mIEF1Z21lbnRhdGlvblxuICAgIC8vICAgICAgID8gQXVnbWVudGF0aW9uW2tdW1wiX2lucHV0XCJdXG4gICAgLy8gICAgICAgOiBrIGV4dGVuZHMga2V5b2YgSW5wdXRcbiAgICAvLyAgICAgICA/IElucHV0W2tdXG4gICAgLy8gICAgICAgOiBuZXZlcjtcbiAgICAvLyAgIH1cbiAgICAvLyA+KFxuICAgIC8vICAgbWVyZ2luZzogSW5jb21pbmdcbiAgICAvLyApOiBab2RPYmplY3Q8XG4gICAgLy8gICBleHRlbmRTaGFwZTxULCBSZXR1cm5UeXBlPEluY29taW5nW1wiX2RlZlwiXVtcInNoYXBlXCJdPj4sXG4gICAgLy8gICBJbmNvbWluZ1tcIl9kZWZcIl1bXCJ1bmtub3duS2V5c1wiXSxcbiAgICAvLyAgIEluY29taW5nW1wiX2RlZlwiXVtcImNhdGNoYWxsXCJdLFxuICAgIC8vICAgTmV3T3V0cHV0LFxuICAgIC8vICAgTmV3SW5wdXRcbiAgICAvLyA+IHtcbiAgICAvLyAgIGNvbnN0IG1lcmdlZDogYW55ID0gbmV3IFpvZE9iamVjdCh7XG4gICAgLy8gICAgIHVua25vd25LZXlzOiBtZXJnaW5nLl9kZWYudW5rbm93bktleXMsXG4gICAgLy8gICAgIGNhdGNoYWxsOiBtZXJnaW5nLl9kZWYuY2F0Y2hhbGwsXG4gICAgLy8gICAgIHNoYXBlOiAoKSA9PlxuICAgIC8vICAgICAgIG9iamVjdFV0aWwubWVyZ2VTaGFwZXModGhpcy5fZGVmLnNoYXBlKCksIG1lcmdpbmcuX2RlZi5zaGFwZSgpKSxcbiAgICAvLyAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RPYmplY3QsXG4gICAgLy8gICB9KSBhcyBhbnk7XG4gICAgLy8gICByZXR1cm4gbWVyZ2VkO1xuICAgIC8vIH1cbiAgICBzZXRLZXkoa2V5LCBzY2hlbWEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXVnbWVudCh7IFtrZXldOiBzY2hlbWEgfSk7XG4gICAgfVxuICAgIC8vIG1lcmdlPEluY29taW5nIGV4dGVuZHMgQW55Wm9kT2JqZWN0PihcbiAgICAvLyAgIG1lcmdpbmc6IEluY29taW5nXG4gICAgLy8gKTogLy9ab2RPYmplY3Q8VCAmIEluY29taW5nW1wiX3NoYXBlXCJdLCBVbmtub3duS2V5cywgQ2F0Y2hhbGw+ID0gKG1lcmdpbmcpID0+IHtcbiAgICAvLyBab2RPYmplY3Q8XG4gICAgLy8gICBleHRlbmRTaGFwZTxULCBSZXR1cm5UeXBlPEluY29taW5nW1wiX2RlZlwiXVtcInNoYXBlXCJdPj4sXG4gICAgLy8gICBJbmNvbWluZ1tcIl9kZWZcIl1bXCJ1bmtub3duS2V5c1wiXSxcbiAgICAvLyAgIEluY29taW5nW1wiX2RlZlwiXVtcImNhdGNoYWxsXCJdXG4gICAgLy8gPiB7XG4gICAgLy8gICAvLyBjb25zdCBtZXJnZWRTaGFwZSA9IG9iamVjdFV0aWwubWVyZ2VTaGFwZXMoXG4gICAgLy8gICAvLyAgIHRoaXMuX2RlZi5zaGFwZSgpLFxuICAgIC8vICAgLy8gICBtZXJnaW5nLl9kZWYuc2hhcGUoKVxuICAgIC8vICAgLy8gKTtcbiAgICAvLyAgIGNvbnN0IG1lcmdlZDogYW55ID0gbmV3IFpvZE9iamVjdCh7XG4gICAgLy8gICAgIHVua25vd25LZXlzOiBtZXJnaW5nLl9kZWYudW5rbm93bktleXMsXG4gICAgLy8gICAgIGNhdGNoYWxsOiBtZXJnaW5nLl9kZWYuY2F0Y2hhbGwsXG4gICAgLy8gICAgIHNoYXBlOiAoKSA9PlxuICAgIC8vICAgICAgIG9iamVjdFV0aWwubWVyZ2VTaGFwZXModGhpcy5fZGVmLnNoYXBlKCksIG1lcmdpbmcuX2RlZi5zaGFwZSgpKSxcbiAgICAvLyAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RPYmplY3QsXG4gICAgLy8gICB9KSBhcyBhbnk7XG4gICAgLy8gICByZXR1cm4gbWVyZ2VkO1xuICAgIC8vIH1cbiAgICBjYXRjaGFsbChpbmRleCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZE9iamVjdCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBjYXRjaGFsbDogaW5kZXgsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBwaWNrKG1hc2spIHtcbiAgICAgICAgY29uc3Qgc2hhcGUgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgdXRpbC5vYmplY3RLZXlzKG1hc2spKSB7XG4gICAgICAgICAgICBpZiAobWFza1trZXldICYmIHRoaXMuc2hhcGVba2V5XSkge1xuICAgICAgICAgICAgICAgIHNoYXBlW2tleV0gPSB0aGlzLnNoYXBlW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBab2RPYmplY3Qoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgc2hhcGU6ICgpID0+IHNoYXBlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgb21pdChtYXNrKSB7XG4gICAgICAgIGNvbnN0IHNoYXBlID0ge307XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIHV0aWwub2JqZWN0S2V5cyh0aGlzLnNoYXBlKSkge1xuICAgICAgICAgICAgaWYgKCFtYXNrW2tleV0pIHtcbiAgICAgICAgICAgICAgICBzaGFwZVtrZXldID0gdGhpcy5zaGFwZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHNoYXBlOiAoKSA9PiBzaGFwZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICovXG4gICAgZGVlcFBhcnRpYWwoKSB7XG4gICAgICAgIHJldHVybiBkZWVwUGFydGlhbGlmeSh0aGlzKTtcbiAgICB9XG4gICAgcGFydGlhbChtYXNrKSB7XG4gICAgICAgIGNvbnN0IG5ld1NoYXBlID0ge307XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIHV0aWwub2JqZWN0S2V5cyh0aGlzLnNoYXBlKSkge1xuICAgICAgICAgICAgY29uc3QgZmllbGRTY2hlbWEgPSB0aGlzLnNoYXBlW2tleV07XG4gICAgICAgICAgICBpZiAobWFzayAmJiAhbWFza1trZXldKSB7XG4gICAgICAgICAgICAgICAgbmV3U2hhcGVba2V5XSA9IGZpZWxkU2NoZW1hO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3U2hhcGVba2V5XSA9IGZpZWxkU2NoZW1hLm9wdGlvbmFsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBab2RPYmplY3Qoe1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgc2hhcGU6ICgpID0+IG5ld1NoYXBlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmVxdWlyZWQobWFzaykge1xuICAgICAgICBjb25zdCBuZXdTaGFwZSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiB1dGlsLm9iamVjdEtleXModGhpcy5zaGFwZSkpIHtcbiAgICAgICAgICAgIGlmIChtYXNrICYmICFtYXNrW2tleV0pIHtcbiAgICAgICAgICAgICAgICBuZXdTaGFwZVtrZXldID0gdGhpcy5zaGFwZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmllbGRTY2hlbWEgPSB0aGlzLnNoYXBlW2tleV07XG4gICAgICAgICAgICAgICAgbGV0IG5ld0ZpZWxkID0gZmllbGRTY2hlbWE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKG5ld0ZpZWxkIGluc3RhbmNlb2YgWm9kT3B0aW9uYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3RmllbGQgPSBuZXdGaWVsZC5fZGVmLmlubmVyVHlwZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbmV3U2hhcGVba2V5XSA9IG5ld0ZpZWxkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHNoYXBlOiAoKSA9PiBuZXdTaGFwZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGtleW9mKCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlWm9kRW51bSh1dGlsLm9iamVjdEtleXModGhpcy5zaGFwZSkpO1xuICAgIH1cbn1cblpvZE9iamVjdC5jcmVhdGUgPSAoc2hhcGUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgc2hhcGU6ICgpID0+IHNoYXBlLFxuICAgICAgICB1bmtub3duS2V5czogXCJzdHJpcFwiLFxuICAgICAgICBjYXRjaGFsbDogWm9kTmV2ZXIuY3JlYXRlKCksXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT2JqZWN0LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuWm9kT2JqZWN0LnN0cmljdENyZWF0ZSA9IChzaGFwZSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RPYmplY3Qoe1xuICAgICAgICBzaGFwZTogKCkgPT4gc2hhcGUsXG4gICAgICAgIHVua25vd25LZXlzOiBcInN0cmljdFwiLFxuICAgICAgICBjYXRjaGFsbDogWm9kTmV2ZXIuY3JlYXRlKCksXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT2JqZWN0LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuWm9kT2JqZWN0LmxhenljcmVhdGUgPSAoc2hhcGUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kT2JqZWN0KHtcbiAgICAgICAgc2hhcGUsXG4gICAgICAgIHVua25vd25LZXlzOiBcInN0cmlwXCIsXG4gICAgICAgIGNhdGNoYWxsOiBab2ROZXZlci5jcmVhdGUoKSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RPYmplY3QsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kVW5pb24gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9kZWYub3B0aW9ucztcbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlUmVzdWx0cyhyZXN1bHRzKSB7XG4gICAgICAgICAgICAvLyByZXR1cm4gZmlyc3QgaXNzdWUtZnJlZSB2YWxpZGF0aW9uIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQucmVzdWx0LnN0YXR1cyA9PT0gXCJ2YWxpZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucmVzdWx0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnJlc3VsdC5zdGF0dXMgPT09IFwiZGlydHlcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgaXNzdWVzIGZyb20gZGlydHkgb3B0aW9uXG4gICAgICAgICAgICAgICAgICAgIGN0eC5jb21tb24uaXNzdWVzLnB1c2goLi4ucmVzdWx0LmN0eC5jb21tb24uaXNzdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gcmV0dXJuIGludmFsaWRcbiAgICAgICAgICAgIGNvbnN0IHVuaW9uRXJyb3JzID0gcmVzdWx0cy5tYXAoKHJlc3VsdCkgPT4gbmV3IFpvZEVycm9yKHJlc3VsdC5jdHguY29tbW9uLmlzc3VlcykpO1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdW5pb24sXG4gICAgICAgICAgICAgICAgdW5pb25FcnJvcnMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwob3B0aW9ucy5tYXAoYXN5bmMgKG9wdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkQ3R4ID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi5jdHgsXG4gICAgICAgICAgICAgICAgICAgIGNvbW1vbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uY3R4LmNvbW1vbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzc3VlczogW10sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbnVsbCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDogYXdhaXQgb3B0aW9uLl9wYXJzZUFzeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGNoaWxkQ3R4LFxuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgY3R4OiBjaGlsZEN0eCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSkpLnRoZW4oaGFuZGxlUmVzdWx0cyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgZGlydHkgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBjb25zdCBpc3N1ZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgb3B0aW9uIG9mIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEN0eCA9IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uY3R4LFxuICAgICAgICAgICAgICAgICAgICBjb21tb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLmN0eC5jb21tb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBpc3N1ZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBvcHRpb24uX3BhcnNlU3luYyh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjaGlsZEN0eCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gXCJ2YWxpZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHJlc3VsdC5zdGF0dXMgPT09IFwiZGlydHlcIiAmJiAhZGlydHkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlydHkgPSB7IHJlc3VsdCwgY3R4OiBjaGlsZEN0eCB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoY2hpbGRDdHguY29tbW9uLmlzc3Vlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNzdWVzLnB1c2goY2hpbGRDdHguY29tbW9uLmlzc3Vlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRpcnR5KSB7XG4gICAgICAgICAgICAgICAgY3R4LmNvbW1vbi5pc3N1ZXMucHVzaCguLi5kaXJ0eS5jdHguY29tbW9uLmlzc3Vlcyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRpcnR5LnJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHVuaW9uRXJyb3JzID0gaXNzdWVzLm1hcCgoaXNzdWVzKSA9PiBuZXcgWm9kRXJyb3IoaXNzdWVzKSk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF91bmlvbixcbiAgICAgICAgICAgICAgICB1bmlvbkVycm9ycyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IG9wdGlvbnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYub3B0aW9ucztcbiAgICB9XG59XG5ab2RVbmlvbi5jcmVhdGUgPSAodHlwZXMsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kVW5pb24oe1xuICAgICAgICBvcHRpb25zOiB0eXBlcyxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RVbmlvbixcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8vLy8vLy8vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vLy8vLy8vLy9cbi8vLy8vLy8vLy8gICAgICBab2REaXNjcmltaW5hdGVkVW5pb24gICAgICAvLy8vLy8vLy8vXG4vLy8vLy8vLy8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8vLy8vLy8vL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5jb25zdCBnZXREaXNjcmltaW5hdG9yID0gKHR5cGUpID0+IHtcbiAgICBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZExhenkpIHtcbiAgICAgICAgcmV0dXJuIGdldERpc2NyaW1pbmF0b3IodHlwZS5zY2hlbWEpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgWm9kRWZmZWN0cykge1xuICAgICAgICByZXR1cm4gZ2V0RGlzY3JpbWluYXRvcih0eXBlLmlubmVyVHlwZSgpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZExpdGVyYWwpIHtcbiAgICAgICAgcmV0dXJuIFt0eXBlLnZhbHVlXTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZEVudW0pIHtcbiAgICAgICAgcmV0dXJuIHR5cGUub3B0aW9ucztcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZE5hdGl2ZUVudW0pIHtcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGJhbi9iYW5cbiAgICAgICAgcmV0dXJuIHV0aWwub2JqZWN0VmFsdWVzKHR5cGUuZW51bSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2REZWZhdWx0KSB7XG4gICAgICAgIHJldHVybiBnZXREaXNjcmltaW5hdG9yKHR5cGUuX2RlZi5pbm5lclR5cGUpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgWm9kVW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbdW5kZWZpbmVkXTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZE51bGwpIHtcbiAgICAgICAgcmV0dXJuIFtudWxsXTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZE9wdGlvbmFsKSB7XG4gICAgICAgIHJldHVybiBbdW5kZWZpbmVkLCAuLi5nZXREaXNjcmltaW5hdG9yKHR5cGUudW53cmFwKCkpXTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSBpbnN0YW5jZW9mIFpvZE51bGxhYmxlKSB7XG4gICAgICAgIHJldHVybiBbbnVsbCwgLi4uZ2V0RGlzY3JpbWluYXRvcih0eXBlLnVud3JhcCgpKV07XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2RCcmFuZGVkKSB7XG4gICAgICAgIHJldHVybiBnZXREaXNjcmltaW5hdG9yKHR5cGUudW53cmFwKCkpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgWm9kUmVhZG9ubHkpIHtcbiAgICAgICAgcmV0dXJuIGdldERpc2NyaW1pbmF0b3IodHlwZS51bndyYXAoKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGUgaW5zdGFuY2VvZiBab2RDYXRjaCkge1xuICAgICAgICByZXR1cm4gZ2V0RGlzY3JpbWluYXRvcih0eXBlLl9kZWYuaW5uZXJUeXBlKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG59O1xuZXhwb3J0IGNsYXNzIFpvZERpc2NyaW1pbmF0ZWRVbmlvbiBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgaWYgKGN0eC5wYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm9iamVjdCkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5vYmplY3QsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkaXNjcmltaW5hdG9yID0gdGhpcy5kaXNjcmltaW5hdG9yO1xuICAgICAgICBjb25zdCBkaXNjcmltaW5hdG9yVmFsdWUgPSBjdHguZGF0YVtkaXNjcmltaW5hdG9yXTtcbiAgICAgICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zTWFwLmdldChkaXNjcmltaW5hdG9yVmFsdWUpO1xuICAgICAgICBpZiAoIW9wdGlvbikge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdW5pb25fZGlzY3JpbWluYXRvcixcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBBcnJheS5mcm9tKHRoaXMub3B0aW9uc01hcC5rZXlzKCkpLFxuICAgICAgICAgICAgICAgIHBhdGg6IFtkaXNjcmltaW5hdG9yXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24uX3BhcnNlQXN5bmMoe1xuICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLl9wYXJzZVN5bmMoe1xuICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGRpc2NyaW1pbmF0b3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuZGlzY3JpbWluYXRvcjtcbiAgICB9XG4gICAgZ2V0IG9wdGlvbnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYub3B0aW9ucztcbiAgICB9XG4gICAgZ2V0IG9wdGlvbnNNYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYub3B0aW9uc01hcDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogVGhlIGNvbnN0cnVjdG9yIG9mIHRoZSBkaXNjcmltaW5hdGVkIHVuaW9uIHNjaGVtYS4gSXRzIGJlaGF2aW91ciBpcyB2ZXJ5IHNpbWlsYXIgdG8gdGhhdCBvZiB0aGUgbm9ybWFsIHoudW5pb24oKSBjb25zdHJ1Y3Rvci5cbiAgICAgKiBIb3dldmVyLCBpdCBvbmx5IGFsbG93cyBhIHVuaW9uIG9mIG9iamVjdHMsIGFsbCBvZiB3aGljaCBuZWVkIHRvIHNoYXJlIGEgZGlzY3JpbWluYXRvciBwcm9wZXJ0eS4gVGhpcyBwcm9wZXJ0eSBtdXN0XG4gICAgICogaGF2ZSBhIGRpZmZlcmVudCB2YWx1ZSBmb3IgZWFjaCBvYmplY3QgaW4gdGhlIHVuaW9uLlxuICAgICAqIEBwYXJhbSBkaXNjcmltaW5hdG9yIHRoZSBuYW1lIG9mIHRoZSBkaXNjcmltaW5hdG9yIHByb3BlcnR5XG4gICAgICogQHBhcmFtIHR5cGVzIGFuIGFycmF5IG9mIG9iamVjdCBzY2hlbWFzXG4gICAgICogQHBhcmFtIHBhcmFtc1xuICAgICAqL1xuICAgIHN0YXRpYyBjcmVhdGUoZGlzY3JpbWluYXRvciwgb3B0aW9ucywgcGFyYW1zKSB7XG4gICAgICAgIC8vIEdldCBhbGwgdGhlIHZhbGlkIGRpc2NyaW1pbmF0b3IgdmFsdWVzXG4gICAgICAgIGNvbnN0IG9wdGlvbnNNYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgdHlwZSBvZiBvcHRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBkaXNjcmltaW5hdG9yVmFsdWVzID0gZ2V0RGlzY3JpbWluYXRvcih0eXBlLnNoYXBlW2Rpc2NyaW1pbmF0b3JdKTtcbiAgICAgICAgICAgIGlmICghZGlzY3JpbWluYXRvclZhbHVlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEEgZGlzY3JpbWluYXRvciB2YWx1ZSBmb3Iga2V5IFxcYCR7ZGlzY3JpbWluYXRvcn1cXGAgY291bGQgbm90IGJlIGV4dHJhY3RlZCBmcm9tIGFsbCBzY2hlbWEgb3B0aW9uc2ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiBkaXNjcmltaW5hdG9yVmFsdWVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnNNYXAuaGFzKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYERpc2NyaW1pbmF0b3IgcHJvcGVydHkgJHtTdHJpbmcoZGlzY3JpbWluYXRvcil9IGhhcyBkdXBsaWNhdGUgdmFsdWUgJHtTdHJpbmcodmFsdWUpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcHRpb25zTWFwLnNldCh2YWx1ZSwgdHlwZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBab2REaXNjcmltaW5hdGVkVW5pb24oe1xuICAgICAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2REaXNjcmltaW5hdGVkVW5pb24sXG4gICAgICAgICAgICBkaXNjcmltaW5hdG9yLFxuICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgIG9wdGlvbnNNYXAsXG4gICAgICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmZ1bmN0aW9uIG1lcmdlVmFsdWVzKGEsIGIpIHtcbiAgICBjb25zdCBhVHlwZSA9IGdldFBhcnNlZFR5cGUoYSk7XG4gICAgY29uc3QgYlR5cGUgPSBnZXRQYXJzZWRUeXBlKGIpO1xuICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBkYXRhOiBhIH07XG4gICAgfVxuICAgIGVsc2UgaWYgKGFUeXBlID09PSBab2RQYXJzZWRUeXBlLm9iamVjdCAmJiBiVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5vYmplY3QpIHtcbiAgICAgICAgY29uc3QgYktleXMgPSB1dGlsLm9iamVjdEtleXMoYik7XG4gICAgICAgIGNvbnN0IHNoYXJlZEtleXMgPSB1dGlsLm9iamVjdEtleXMoYSkuZmlsdGVyKChrZXkpID0+IGJLZXlzLmluZGV4T2Yoa2V5KSAhPT0gLTEpO1xuICAgICAgICBjb25zdCBuZXdPYmogPSB7IC4uLmEsIC4uLmIgfTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2Ygc2hhcmVkS2V5cykge1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVkVmFsdWUgPSBtZXJnZVZhbHVlcyhhW2tleV0sIGJba2V5XSk7XG4gICAgICAgICAgICBpZiAoIXNoYXJlZFZhbHVlLnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXdPYmpba2V5XSA9IHNoYXJlZFZhbHVlLmRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IHRydWUsIGRhdGE6IG5ld09iaiB9O1xuICAgIH1cbiAgICBlbHNlIGlmIChhVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5hcnJheSAmJiBiVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5hcnJheSkge1xuICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuZXdBcnJheSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgYS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1BID0gYVtpbmRleF07XG4gICAgICAgICAgICBjb25zdCBpdGVtQiA9IGJbaW5kZXhdO1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVkVmFsdWUgPSBtZXJnZVZhbHVlcyhpdGVtQSwgaXRlbUIpO1xuICAgICAgICAgICAgaWYgKCFzaGFyZWRWYWx1ZS52YWxpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV3QXJyYXkucHVzaChzaGFyZWRWYWx1ZS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgZGF0YTogbmV3QXJyYXkgfTtcbiAgICB9XG4gICAgZWxzZSBpZiAoYVR5cGUgPT09IFpvZFBhcnNlZFR5cGUuZGF0ZSAmJiBiVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5kYXRlICYmICthID09PSArYikge1xuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgZGF0YTogYSB9O1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlIH07XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFpvZEludGVyc2VjdGlvbiBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IHN0YXR1cywgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBjb25zdCBoYW5kbGVQYXJzZWQgPSAocGFyc2VkTGVmdCwgcGFyc2VkUmlnaHQpID0+IHtcbiAgICAgICAgICAgIGlmIChpc0Fib3J0ZWQocGFyc2VkTGVmdCkgfHwgaXNBYm9ydGVkKHBhcnNlZFJpZ2h0KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbWVyZ2VkID0gbWVyZ2VWYWx1ZXMocGFyc2VkTGVmdC52YWx1ZSwgcGFyc2VkUmlnaHQudmFsdWUpO1xuICAgICAgICAgICAgaWYgKCFtZXJnZWQudmFsaWQpIHtcbiAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfaW50ZXJzZWN0aW9uX3R5cGVzLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzRGlydHkocGFyc2VkTGVmdCkgfHwgaXNEaXJ0eShwYXJzZWRSaWdodCkpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogbWVyZ2VkLmRhdGEgfTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICAgICAgdGhpcy5fZGVmLmxlZnQuX3BhcnNlQXN5bmMoe1xuICAgICAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIHRoaXMuX2RlZi5yaWdodC5fcGFyc2VBc3luYyh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdKS50aGVuKChbbGVmdCwgcmlnaHRdKSA9PiBoYW5kbGVQYXJzZWQobGVmdCwgcmlnaHQpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVQYXJzZWQodGhpcy5fZGVmLmxlZnQuX3BhcnNlU3luYyh7XG4gICAgICAgICAgICAgICAgZGF0YTogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgICAgICB9KSwgdGhpcy5fZGVmLnJpZ2h0Ll9wYXJzZVN5bmMoe1xuICAgICAgICAgICAgICAgIGRhdGE6IGN0eC5kYXRhLFxuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufVxuWm9kSW50ZXJzZWN0aW9uLmNyZWF0ZSA9IChsZWZ0LCByaWdodCwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RJbnRlcnNlY3Rpb24oe1xuICAgICAgICBsZWZ0OiBsZWZ0LFxuICAgICAgICByaWdodDogcmlnaHQsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kSW50ZXJzZWN0aW9uLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuLy8gdHlwZSBab2RUdXBsZUl0ZW1zID0gW1pvZFR5cGVBbnksIC4uLlpvZFR5cGVBbnlbXV07XG5leHBvcnQgY2xhc3MgWm9kVHVwbGUgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0dXMsIGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgaWYgKGN0eC5wYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLmFycmF5KSB7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLmFycmF5LFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN0eC5kYXRhLmxlbmd0aCA8IHRoaXMuX2RlZi5pdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS50b29fc21hbGwsXG4gICAgICAgICAgICAgICAgbWluaW11bTogdGhpcy5fZGVmLml0ZW1zLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdCA9IHRoaXMuX2RlZi5yZXN0O1xuICAgICAgICBpZiAoIXJlc3QgJiYgY3R4LmRhdGEubGVuZ3RoID4gdGhpcy5fZGVmLml0ZW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19iaWcsXG4gICAgICAgICAgICAgICAgbWF4aW11bTogdGhpcy5fZGVmLml0ZW1zLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBpbmNsdXNpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaXRlbXMgPSBbLi4uY3R4LmRhdGFdXG4gICAgICAgICAgICAubWFwKChpdGVtLCBpdGVtSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuX2RlZi5pdGVtc1tpdGVtSW5kZXhdIHx8IHRoaXMuX2RlZi5yZXN0O1xuICAgICAgICAgICAgaWYgKCFzY2hlbWEpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXR1cm4gc2NoZW1hLl9wYXJzZShuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgaXRlbSwgY3R4LnBhdGgsIGl0ZW1JbmRleCkpO1xuICAgICAgICB9KVxuICAgICAgICAgICAgLmZpbHRlcigoeCkgPT4gISF4KTsgLy8gZmlsdGVyIG51bGxzXG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoaXRlbXMpLnRoZW4oKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VBcnJheShzdGF0dXMsIHJlc3VsdHMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VBcnJheShzdGF0dXMsIGl0ZW1zKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZXQgaXRlbXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaXRlbXM7XG4gICAgfVxuICAgIHJlc3QocmVzdCkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZFR1cGxlKHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIHJlc3QsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblpvZFR1cGxlLmNyZWF0ZSA9IChzY2hlbWFzLCBwYXJhbXMpID0+IHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoc2NoZW1hcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3QgcGFzcyBhbiBhcnJheSBvZiBzY2hlbWFzIHRvIHoudHVwbGUoWyAuLi4gXSlcIik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgWm9kVHVwbGUoe1xuICAgICAgICBpdGVtczogc2NoZW1hcyxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RUdXBsZSxcbiAgICAgICAgcmVzdDogbnVsbCxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RSZWNvcmQgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBnZXQga2V5U2NoZW1hKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmtleVR5cGU7XG4gICAgfVxuICAgIGdldCB2YWx1ZVNjaGVtYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi52YWx1ZVR5cGU7XG4gICAgfVxuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IHN0YXR1cywgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBpZiAoY3R4LnBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUub2JqZWN0KSB7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLm9iamVjdCxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhaXJzID0gW107XG4gICAgICAgIGNvbnN0IGtleVR5cGUgPSB0aGlzLl9kZWYua2V5VHlwZTtcbiAgICAgICAgY29uc3QgdmFsdWVUeXBlID0gdGhpcy5fZGVmLnZhbHVlVHlwZTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gY3R4LmRhdGEpIHtcbiAgICAgICAgICAgIHBhaXJzLnB1c2goe1xuICAgICAgICAgICAgICAgIGtleToga2V5VHlwZS5fcGFyc2UobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIGtleSwgY3R4LnBhdGgsIGtleSkpLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZVR5cGUuX3BhcnNlKG5ldyBQYXJzZUlucHV0TGF6eVBhdGgoY3R4LCBjdHguZGF0YVtrZXldLCBjdHgucGF0aCwga2V5KSksXG4gICAgICAgICAgICAgICAgYWx3YXlzU2V0OiBrZXkgaW4gY3R4LmRhdGEsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYykge1xuICAgICAgICAgICAgcmV0dXJuIFBhcnNlU3RhdHVzLm1lcmdlT2JqZWN0QXN5bmMoc3RhdHVzLCBwYWlycyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gUGFyc2VTdGF0dXMubWVyZ2VPYmplY3RTeW5jKHN0YXR1cywgcGFpcnMpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGdldCBlbGVtZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnZhbHVlVHlwZTtcbiAgICB9XG4gICAgc3RhdGljIGNyZWF0ZShmaXJzdCwgc2Vjb25kLCB0aGlyZCkge1xuICAgICAgICBpZiAoc2Vjb25kIGluc3RhbmNlb2YgWm9kVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBab2RSZWNvcmQoe1xuICAgICAgICAgICAgICAgIGtleVR5cGU6IGZpcnN0LFxuICAgICAgICAgICAgICAgIHZhbHVlVHlwZTogc2Vjb25kLFxuICAgICAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kUmVjb3JkLFxuICAgICAgICAgICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXModGhpcmQpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBab2RSZWNvcmQoe1xuICAgICAgICAgICAga2V5VHlwZTogWm9kU3RyaW5nLmNyZWF0ZSgpLFxuICAgICAgICAgICAgdmFsdWVUeXBlOiBmaXJzdCxcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kUmVjb3JkLFxuICAgICAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhzZWNvbmQpLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgWm9kTWFwIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgZ2V0IGtleVNjaGVtYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5rZXlUeXBlO1xuICAgIH1cbiAgICBnZXQgdmFsdWVTY2hlbWEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYudmFsdWVUeXBlO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0dXMsIGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgaWYgKGN0eC5wYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLm1hcCkge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5tYXAsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBrZXlUeXBlID0gdGhpcy5fZGVmLmtleVR5cGU7XG4gICAgICAgIGNvbnN0IHZhbHVlVHlwZSA9IHRoaXMuX2RlZi52YWx1ZVR5cGU7XG4gICAgICAgIGNvbnN0IHBhaXJzID0gWy4uLmN0eC5kYXRhLmVudHJpZXMoKV0ubWFwKChba2V5LCB2YWx1ZV0sIGluZGV4KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGtleToga2V5VHlwZS5fcGFyc2UobmV3IFBhcnNlSW5wdXRMYXp5UGF0aChjdHgsIGtleSwgY3R4LnBhdGgsIFtpbmRleCwgXCJrZXlcIl0pKSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVUeXBlLl9wYXJzZShuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgdmFsdWUsIGN0eC5wYXRoLCBbaW5kZXgsIFwidmFsdWVcIl0pKSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYykge1xuICAgICAgICAgICAgY29uc3QgZmluYWxNYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwYWlyIG9mIHBhaXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IGF3YWl0IHBhaXIua2V5O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHBhaXIudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChrZXkuc3RhdHVzID09PSBcImFib3J0ZWRcIiB8fCB2YWx1ZS5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5LnN0YXR1cyA9PT0gXCJkaXJ0eVwiIHx8IHZhbHVlLnN0YXR1cyA9PT0gXCJkaXJ0eVwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmaW5hbE1hcC5zZXQoa2V5LnZhbHVlLCB2YWx1ZS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogZmluYWxNYXAgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZmluYWxNYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHBhaXIgb2YgcGFpcnMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBwYWlyLmtleTtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHBhaXIudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKGtleS5zdGF0dXMgPT09IFwiYWJvcnRlZFwiIHx8IHZhbHVlLnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChrZXkuc3RhdHVzID09PSBcImRpcnR5XCIgfHwgdmFsdWUuc3RhdHVzID09PSBcImRpcnR5XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZpbmFsTWFwLnNldChrZXkudmFsdWUsIHZhbHVlLnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogZmluYWxNYXAgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cblpvZE1hcC5jcmVhdGUgPSAoa2V5VHlwZSwgdmFsdWVUeXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZE1hcCh7XG4gICAgICAgIHZhbHVlVHlwZSxcbiAgICAgICAga2V5VHlwZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RNYXAsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kU2V0IGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzLCBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5zZXQpIHtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX3R5cGUsXG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IFpvZFBhcnNlZFR5cGUuc2V0LFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGVmID0gdGhpcy5fZGVmO1xuICAgICAgICBpZiAoZGVmLm1pblNpemUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChjdHguZGF0YS5zaXplIDwgZGVmLm1pblNpemUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLnRvb19zbWFsbCxcbiAgICAgICAgICAgICAgICAgICAgbWluaW11bTogZGVmLm1pblNpemUudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic2V0XCIsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBkZWYubWluU2l6ZS5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkZWYubWF4U2l6ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGN0eC5kYXRhLnNpemUgPiBkZWYubWF4U2l6ZS52YWx1ZSkge1xuICAgICAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUudG9vX2JpZyxcbiAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogZGVmLm1heFNpemUudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFwic2V0XCIsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1c2l2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXhhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBkZWYubWF4U2l6ZS5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHZhbHVlVHlwZSA9IHRoaXMuX2RlZi52YWx1ZVR5cGU7XG4gICAgICAgIGZ1bmN0aW9uIGZpbmFsaXplU2V0KGVsZW1lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRTZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC5zdGF0dXMgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgcGFyc2VkU2V0LmFkZChlbGVtZW50LnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogcGFyc2VkU2V0IH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZWxlbWVudHMgPSBbLi4uY3R4LmRhdGEudmFsdWVzKCldLm1hcCgoaXRlbSwgaSkgPT4gdmFsdWVUeXBlLl9wYXJzZShuZXcgUGFyc2VJbnB1dExhenlQYXRoKGN0eCwgaXRlbSwgY3R4LnBhdGgsIGkpKSk7XG4gICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZWxlbWVudHMpLnRoZW4oKGVsZW1lbnRzKSA9PiBmaW5hbGl6ZVNldChlbGVtZW50cykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZpbmFsaXplU2V0KGVsZW1lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBtaW4obWluU2l6ZSwgbWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbmV3IFpvZFNldCh7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBtaW5TaXplOiB7IHZhbHVlOiBtaW5TaXplLCBtZXNzYWdlOiBlcnJvclV0aWwudG9TdHJpbmcobWVzc2FnZSkgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIG1heChtYXhTaXplLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kU2V0KHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIG1heFNpemU6IHsgdmFsdWU6IG1heFNpemUsIG1lc3NhZ2U6IGVycm9yVXRpbC50b1N0cmluZyhtZXNzYWdlKSB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgc2l6ZShzaXplLCBtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pbihzaXplLCBtZXNzYWdlKS5tYXgoc2l6ZSwgbWVzc2FnZSk7XG4gICAgfVxuICAgIG5vbmVtcHR5KG1lc3NhZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWluKDEsIG1lc3NhZ2UpO1xuICAgIH1cbn1cblpvZFNldC5jcmVhdGUgPSAodmFsdWVUeXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFNldCh7XG4gICAgICAgIHZhbHVlVHlwZSxcbiAgICAgICAgbWluU2l6ZTogbnVsbCxcbiAgICAgICAgbWF4U2l6ZTogbnVsbCxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RTZXQsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kRnVuY3Rpb24gZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy52YWxpZGF0ZSA9IHRoaXMuaW1wbGVtZW50O1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5mdW5jdGlvbikge1xuICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCB7XG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogWm9kUGFyc2VkVHlwZS5mdW5jdGlvbixcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIG1ha2VBcmdzSXNzdWUoYXJncywgZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiBtYWtlSXNzdWUoe1xuICAgICAgICAgICAgICAgIGRhdGE6IGFyZ3MsXG4gICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgZXJyb3JNYXBzOiBbY3R4LmNvbW1vbi5jb250ZXh0dWFsRXJyb3JNYXAsIGN0eC5zY2hlbWFFcnJvck1hcCwgZ2V0RXJyb3JNYXAoKSwgZGVmYXVsdEVycm9yTWFwXS5maWx0ZXIoKHgpID0+ICEheCksXG4gICAgICAgICAgICAgICAgaXNzdWVEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IFpvZElzc3VlQ29kZS5pbnZhbGlkX2FyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgYXJndW1lbnRzRXJyb3I6IGVycm9yLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBtYWtlUmV0dXJuc0lzc3VlKHJldHVybnMsIGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gbWFrZUlzc3VlKHtcbiAgICAgICAgICAgICAgICBkYXRhOiByZXR1cm5zLFxuICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgIGVycm9yTWFwczogW2N0eC5jb21tb24uY29udGV4dHVhbEVycm9yTWFwLCBjdHguc2NoZW1hRXJyb3JNYXAsIGdldEVycm9yTWFwKCksIGRlZmF1bHRFcnJvck1hcF0uZmlsdGVyKCh4KSA9PiAhIXgpLFxuICAgICAgICAgICAgICAgIGlzc3VlRGF0YToge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9yZXR1cm5fdHlwZSxcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuVHlwZUVycm9yOiBlcnJvcixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyYW1zID0geyBlcnJvck1hcDogY3R4LmNvbW1vbi5jb250ZXh0dWFsRXJyb3JNYXAgfTtcbiAgICAgICAgY29uc3QgZm4gPSBjdHguZGF0YTtcbiAgICAgICAgaWYgKHRoaXMuX2RlZi5yZXR1cm5zIGluc3RhbmNlb2YgWm9kUHJvbWlzZSkge1xuICAgICAgICAgICAgLy8gV291bGQgbG92ZSBhIHdheSB0byBhdm9pZCBkaXNhYmxpbmcgdGhpcyBydWxlLCBidXQgd2UgbmVlZFxuICAgICAgICAgICAgLy8gYW4gYWxpYXMgKHVzaW5nIGFuIGFycm93IGZ1bmN0aW9uIHdhcyB3aGF0IGNhdXNlZCAyNjUxKS5cbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdGhpcy1hbGlhc1xuICAgICAgICAgICAgY29uc3QgbWUgPSB0aGlzO1xuICAgICAgICAgICAgcmV0dXJuIE9LKGFzeW5jIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgWm9kRXJyb3IoW10pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZEFyZ3MgPSBhd2FpdCBtZS5fZGVmLmFyZ3MucGFyc2VBc3luYyhhcmdzLCBwYXJhbXMpLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yLmFkZElzc3VlKG1ha2VBcmdzSXNzdWUoYXJncywgZSkpO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBSZWZsZWN0LmFwcGx5KGZuLCB0aGlzLCBwYXJzZWRBcmdzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRSZXR1cm5zID0gYXdhaXQgbWUuX2RlZi5yZXR1cm5zLl9kZWYudHlwZVxuICAgICAgICAgICAgICAgICAgICAucGFyc2VBc3luYyhyZXN1bHQsIHBhcmFtcylcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yLmFkZElzc3VlKG1ha2VSZXR1cm5zSXNzdWUocmVzdWx0LCBlKSk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZWRSZXR1cm5zO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBXb3VsZCBsb3ZlIGEgd2F5IHRvIGF2b2lkIGRpc2FibGluZyB0aGlzIHJ1bGUsIGJ1dCB3ZSBuZWVkXG4gICAgICAgICAgICAvLyBhbiBhbGlhcyAodXNpbmcgYW4gYXJyb3cgZnVuY3Rpb24gd2FzIHdoYXQgY2F1c2VkIDI2NTEpLlxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby10aGlzLWFsaWFzXG4gICAgICAgICAgICBjb25zdCBtZSA9IHRoaXM7XG4gICAgICAgICAgICByZXR1cm4gT0soZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRBcmdzID0gbWUuX2RlZi5hcmdzLnNhZmVQYXJzZShhcmdzLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIGlmICghcGFyc2VkQXJncy5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBab2RFcnJvcihbbWFrZUFyZ3NJc3N1ZShhcmdzLCBwYXJzZWRBcmdzLmVycm9yKV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBSZWZsZWN0LmFwcGx5KGZuLCB0aGlzLCBwYXJzZWRBcmdzLmRhdGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZFJldHVybnMgPSBtZS5fZGVmLnJldHVybnMuc2FmZVBhcnNlKHJlc3VsdCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcnNlZFJldHVybnMuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgWm9kRXJyb3IoW21ha2VSZXR1cm5zSXNzdWUocmVzdWx0LCBwYXJzZWRSZXR1cm5zLmVycm9yKV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VkUmV0dXJucy5kYXRhO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcGFyYW1ldGVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5hcmdzO1xuICAgIH1cbiAgICByZXR1cm5UeXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnJldHVybnM7XG4gICAgfVxuICAgIGFyZ3MoLi4uaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RGdW5jdGlvbih7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICBhcmdzOiBab2RUdXBsZS5jcmVhdGUoaXRlbXMpLnJlc3QoWm9kVW5rbm93bi5jcmVhdGUoKSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm5zKHJldHVyblR5cGUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RGdW5jdGlvbih7XG4gICAgICAgICAgICAuLi50aGlzLl9kZWYsXG4gICAgICAgICAgICByZXR1cm5zOiByZXR1cm5UeXBlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgaW1wbGVtZW50KGZ1bmMpIHtcbiAgICAgICAgY29uc3QgdmFsaWRhdGVkRnVuYyA9IHRoaXMucGFyc2UoZnVuYyk7XG4gICAgICAgIHJldHVybiB2YWxpZGF0ZWRGdW5jO1xuICAgIH1cbiAgICBzdHJpY3RJbXBsZW1lbnQoZnVuYykge1xuICAgICAgICBjb25zdCB2YWxpZGF0ZWRGdW5jID0gdGhpcy5wYXJzZShmdW5jKTtcbiAgICAgICAgcmV0dXJuIHZhbGlkYXRlZEZ1bmM7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGUoYXJncywgcmV0dXJucywgcGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgWm9kRnVuY3Rpb24oe1xuICAgICAgICAgICAgYXJnczogKGFyZ3MgPyBhcmdzIDogWm9kVHVwbGUuY3JlYXRlKFtdKS5yZXN0KFpvZFVua25vd24uY3JlYXRlKCkpKSxcbiAgICAgICAgICAgIHJldHVybnM6IHJldHVybnMgfHwgWm9kVW5rbm93bi5jcmVhdGUoKSxcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRnVuY3Rpb24sXG4gICAgICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBab2RMYXp5IGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgZ2V0IHNjaGVtYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5nZXR0ZXIoKTtcbiAgICB9XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBjb25zdCBsYXp5U2NoZW1hID0gdGhpcy5fZGVmLmdldHRlcigpO1xuICAgICAgICByZXR1cm4gbGF6eVNjaGVtYS5fcGFyc2UoeyBkYXRhOiBjdHguZGF0YSwgcGF0aDogY3R4LnBhdGgsIHBhcmVudDogY3R4IH0pO1xuICAgIH1cbn1cblpvZExhenkuY3JlYXRlID0gKGdldHRlciwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RMYXp5KHtcbiAgICAgICAgZ2V0dGVyOiBnZXR0ZXIsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kTGF6eSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RMaXRlcmFsIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGlmIChpbnB1dC5kYXRhICE9PSB0aGlzLl9kZWYudmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9saXRlcmFsLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiB0aGlzLl9kZWYudmFsdWUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogXCJ2YWxpZFwiLCB2YWx1ZTogaW5wdXQuZGF0YSB9O1xuICAgIH1cbiAgICBnZXQgdmFsdWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYudmFsdWU7XG4gICAgfVxufVxuWm9kTGl0ZXJhbC5jcmVhdGUgPSAodmFsdWUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTGl0ZXJhbCh7XG4gICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RMaXRlcmFsLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZnVuY3Rpb24gY3JlYXRlWm9kRW51bSh2YWx1ZXMsIHBhcmFtcykge1xuICAgIHJldHVybiBuZXcgWm9kRW51bSh7XG4gICAgICAgIHZhbHVlcyxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RFbnVtLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59XG5leHBvcnQgY2xhc3MgWm9kRW51bSBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBpZiAodHlwZW9mIGlucHV0LmRhdGEgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVmFsdWVzID0gdGhpcy5fZGVmLnZhbHVlcztcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiB1dGlsLmpvaW5WYWx1ZXMoZXhwZWN0ZWRWYWx1ZXMpLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHgucGFyc2VkVHlwZSxcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2NhY2hlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZSA9IG5ldyBTZXQodGhpcy5fZGVmLnZhbHVlcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLl9jYWNoZS5oYXMoaW5wdXQuZGF0YSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVmFsdWVzID0gdGhpcy5fZGVmLnZhbHVlcztcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9lbnVtX3ZhbHVlLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IGV4cGVjdGVkVmFsdWVzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxuICAgIGdldCBvcHRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnZhbHVlcztcbiAgICB9XG4gICAgZ2V0IGVudW0oKSB7XG4gICAgICAgIGNvbnN0IGVudW1WYWx1ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCB2YWwgb2YgdGhpcy5fZGVmLnZhbHVlcykge1xuICAgICAgICAgICAgZW51bVZhbHVlc1t2YWxdID0gdmFsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbnVtVmFsdWVzO1xuICAgIH1cbiAgICBnZXQgVmFsdWVzKCkge1xuICAgICAgICBjb25zdCBlbnVtVmFsdWVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgdmFsIG9mIHRoaXMuX2RlZi52YWx1ZXMpIHtcbiAgICAgICAgICAgIGVudW1WYWx1ZXNbdmFsXSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZW51bVZhbHVlcztcbiAgICB9XG4gICAgZ2V0IEVudW0oKSB7XG4gICAgICAgIGNvbnN0IGVudW1WYWx1ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCB2YWwgb2YgdGhpcy5fZGVmLnZhbHVlcykge1xuICAgICAgICAgICAgZW51bVZhbHVlc1t2YWxdID0gdmFsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbnVtVmFsdWVzO1xuICAgIH1cbiAgICBleHRyYWN0KHZhbHVlcywgbmV3RGVmID0gdGhpcy5fZGVmKSB7XG4gICAgICAgIHJldHVybiBab2RFbnVtLmNyZWF0ZSh2YWx1ZXMsIHtcbiAgICAgICAgICAgIC4uLnRoaXMuX2RlZixcbiAgICAgICAgICAgIC4uLm5ld0RlZixcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGV4Y2x1ZGUodmFsdWVzLCBuZXdEZWYgPSB0aGlzLl9kZWYpIHtcbiAgICAgICAgcmV0dXJuIFpvZEVudW0uY3JlYXRlKHRoaXMub3B0aW9ucy5maWx0ZXIoKG9wdCkgPT4gIXZhbHVlcy5pbmNsdWRlcyhvcHQpKSwge1xuICAgICAgICAgICAgLi4udGhpcy5fZGVmLFxuICAgICAgICAgICAgLi4ubmV3RGVmLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5ab2RFbnVtLmNyZWF0ZSA9IGNyZWF0ZVpvZEVudW07XG5leHBvcnQgY2xhc3MgWm9kTmF0aXZlRW51bSBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCBuYXRpdmVFbnVtVmFsdWVzID0gdXRpbC5nZXRWYWxpZEVudW1WYWx1ZXModGhpcy5fZGVmLnZhbHVlcyk7XG4gICAgICAgIGNvbnN0IGN0eCA9IHRoaXMuX2dldE9yUmV0dXJuQ3R4KGlucHV0KTtcbiAgICAgICAgaWYgKGN0eC5wYXJzZWRUeXBlICE9PSBab2RQYXJzZWRUeXBlLnN0cmluZyAmJiBjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5udW1iZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVmFsdWVzID0gdXRpbC5vYmplY3RWYWx1ZXMobmF0aXZlRW51bVZhbHVlcyk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZDogdXRpbC5qb2luVmFsdWVzKGV4cGVjdGVkVmFsdWVzKSxcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICAgICAgY29kZTogWm9kSXNzdWVDb2RlLmludmFsaWRfdHlwZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLl9jYWNoZSkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGUgPSBuZXcgU2V0KHV0aWwuZ2V0VmFsaWRFbnVtVmFsdWVzKHRoaXMuX2RlZi52YWx1ZXMpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2NhY2hlLmhhcyhpbnB1dC5kYXRhKSkge1xuICAgICAgICAgICAgY29uc3QgZXhwZWN0ZWRWYWx1ZXMgPSB1dGlsLm9iamVjdFZhbHVlcyhuYXRpdmVFbnVtVmFsdWVzKTtcbiAgICAgICAgICAgIGFkZElzc3VlVG9Db250ZXh0KGN0eCwge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVkOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF9lbnVtX3ZhbHVlLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IGV4cGVjdGVkVmFsdWVzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gT0soaW5wdXQuZGF0YSk7XG4gICAgfVxuICAgIGdldCBlbnVtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnZhbHVlcztcbiAgICB9XG59XG5ab2ROYXRpdmVFbnVtLmNyZWF0ZSA9ICh2YWx1ZXMsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kTmF0aXZlRW51bSh7XG4gICAgICAgIHZhbHVlczogdmFsdWVzLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE5hdGl2ZUVudW0sXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kUHJvbWlzZSBleHRlbmRzIFpvZFR5cGUge1xuICAgIHVud3JhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi50eXBlO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBjdHggfSA9IHRoaXMuX3Byb2Nlc3NJbnB1dFBhcmFtcyhpbnB1dCk7XG4gICAgICAgIGlmIChjdHgucGFyc2VkVHlwZSAhPT0gWm9kUGFyc2VkVHlwZS5wcm9taXNlICYmIGN0eC5jb21tb24uYXN5bmMgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLnByb21pc2UsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZWQ6IGN0eC5wYXJzZWRUeXBlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm9taXNpZmllZCA9IGN0eC5wYXJzZWRUeXBlID09PSBab2RQYXJzZWRUeXBlLnByb21pc2UgPyBjdHguZGF0YSA6IFByb21pc2UucmVzb2x2ZShjdHguZGF0YSk7XG4gICAgICAgIHJldHVybiBPSyhwcm9taXNpZmllZC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnR5cGUucGFyc2VBc3luYyhkYXRhLCB7XG4gICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgZXJyb3JNYXA6IGN0eC5jb21tb24uY29udGV4dHVhbEVycm9yTWFwLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKTtcbiAgICB9XG59XG5ab2RQcm9taXNlLmNyZWF0ZSA9IChzY2hlbWEsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kUHJvbWlzZSh7XG4gICAgICAgIHR5cGU6IHNjaGVtYSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RQcm9taXNlLFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuZXhwb3J0IGNsYXNzIFpvZEVmZmVjdHMgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBpbm5lclR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuc2NoZW1hO1xuICAgIH1cbiAgICBzb3VyY2VUeXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLnNjaGVtYS5fZGVmLnR5cGVOYW1lID09PSBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kRWZmZWN0c1xuICAgICAgICAgICAgPyB0aGlzLl9kZWYuc2NoZW1hLnNvdXJjZVR5cGUoKVxuICAgICAgICAgICAgOiB0aGlzLl9kZWYuc2NoZW1hO1xuICAgIH1cbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0dXMsIGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgY29uc3QgZWZmZWN0ID0gdGhpcy5fZGVmLmVmZmVjdCB8fCBudWxsO1xuICAgICAgICBjb25zdCBjaGVja0N0eCA9IHtcbiAgICAgICAgICAgIGFkZElzc3VlOiAoYXJnKSA9PiB7XG4gICAgICAgICAgICAgICAgYWRkSXNzdWVUb0NvbnRleHQoY3R4LCBhcmcpO1xuICAgICAgICAgICAgICAgIGlmIChhcmcuZmF0YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzLmFib3J0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0IHBhdGgoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5wYXRoO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgICAgY2hlY2tDdHguYWRkSXNzdWUgPSBjaGVja0N0eC5hZGRJc3N1ZS5iaW5kKGNoZWNrQ3R4KTtcbiAgICAgICAgaWYgKGVmZmVjdC50eXBlID09PSBcInByZXByb2Nlc3NcIikge1xuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc2VkID0gZWZmZWN0LnRyYW5zZm9ybShjdHguZGF0YSwgY2hlY2tDdHgpO1xuICAgICAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHByb2Nlc3NlZCkudGhlbihhc3luYyAocHJvY2Vzc2VkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0dXMudmFsdWUgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX2RlZi5zY2hlbWEuX3BhcnNlQXN5bmMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogcHJvY2Vzc2VkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gXCJkaXJ0eVwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIERJUlRZKHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0dXMudmFsdWUgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBESVJUWShyZXN1bHQudmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXR1cy52YWx1ZSA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2RlZi5zY2hlbWEuX3BhcnNlU3luYyh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHByb2Nlc3NlZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IFwiZGlydHlcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIERJUlRZKHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXR1cy52YWx1ZSA9PT0gXCJkaXJ0eVwiKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gRElSVFkocmVzdWx0LnZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlZmZlY3QudHlwZSA9PT0gXCJyZWZpbmVtZW50XCIpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4ZWN1dGVSZWZpbmVtZW50ID0gKGFjYykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGVmZmVjdC5yZWZpbmVtZW50KGFjYywgY2hlY2tDdHgpO1xuICAgICAgICAgICAgICAgIGlmIChjdHguY29tbW9uLmFzeW5jKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQXN5bmMgcmVmaW5lbWVudCBlbmNvdW50ZXJlZCBkdXJpbmcgc3luY2hyb25vdXMgcGFyc2Ugb3BlcmF0aW9uLiBVc2UgLnBhcnNlQXN5bmMgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5uZXIgPSB0aGlzLl9kZWYuc2NoZW1hLl9wYXJzZVN5bmMoe1xuICAgICAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChpbm5lci5zdGF0dXMgPT09IFwiYWJvcnRlZFwiKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSU5WQUxJRDtcbiAgICAgICAgICAgICAgICBpZiAoaW5uZXIuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIC8vIHJldHVybiB2YWx1ZSBpcyBpZ25vcmVkXG4gICAgICAgICAgICAgICAgZXhlY3V0ZVJlZmluZW1lbnQoaW5uZXIudmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogaW5uZXIudmFsdWUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWYuc2NoZW1hLl9wYXJzZUFzeW5jKHsgZGF0YTogY3R4LmRhdGEsIHBhdGg6IGN0eC5wYXRoLCBwYXJlbnQ6IGN0eCB9KS50aGVuKChpbm5lcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5uZXIuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5uZXIuc3RhdHVzID09PSBcImRpcnR5XCIpXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4ZWN1dGVSZWZpbmVtZW50KGlubmVyLnZhbHVlKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogc3RhdHVzLnZhbHVlLCB2YWx1ZTogaW5uZXIudmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVmZmVjdC50eXBlID09PSBcInRyYW5zZm9ybVwiKSB7XG4gICAgICAgICAgICBpZiAoY3R4LmNvbW1vbi5hc3luYyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlID0gdGhpcy5fZGVmLnNjaGVtYS5fcGFyc2VTeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzVmFsaWQoYmFzZSkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGVmZmVjdC50cmFuc2Zvcm0oYmFzZS52YWx1ZSwgY2hlY2tDdHgpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXN5bmNocm9ub3VzIHRyYW5zZm9ybSBlbmNvdW50ZXJlZCBkdXJpbmcgc3luY2hyb25vdXMgcGFyc2Ugb3BlcmF0aW9uLiBVc2UgLnBhcnNlQXN5bmMgaW5zdGVhZC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiBzdGF0dXMudmFsdWUsIHZhbHVlOiByZXN1bHQgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWYuc2NoZW1hLl9wYXJzZUFzeW5jKHsgZGF0YTogY3R4LmRhdGEsIHBhdGg6IGN0eC5wYXRoLCBwYXJlbnQ6IGN0eCB9KS50aGVuKChiYXNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNWYWxpZChiYXNlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVmZmVjdC50cmFuc2Zvcm0oYmFzZS52YWx1ZSwgY2hlY2tDdHgpKS50aGVuKChyZXN1bHQpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHN0YXR1cy52YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB1dGlsLmFzc2VydE5ldmVyKGVmZmVjdCk7XG4gICAgfVxufVxuWm9kRWZmZWN0cy5jcmVhdGUgPSAoc2NoZW1hLCBlZmZlY3QsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kRWZmZWN0cyh7XG4gICAgICAgIHNjaGVtYSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2RFZmZlY3RzLFxuICAgICAgICBlZmZlY3QsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5ab2RFZmZlY3RzLmNyZWF0ZVdpdGhQcmVwcm9jZXNzID0gKHByZXByb2Nlc3MsIHNjaGVtYSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2RFZmZlY3RzKHtcbiAgICAgICAgc2NoZW1hLFxuICAgICAgICBlZmZlY3Q6IHsgdHlwZTogXCJwcmVwcm9jZXNzXCIsIHRyYW5zZm9ybTogcHJlcHJvY2VzcyB9LFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZEVmZmVjdHMsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgeyBab2RFZmZlY3RzIGFzIFpvZFRyYW5zZm9ybWVyIH07XG5leHBvcnQgY2xhc3MgWm9kT3B0aW9uYWwgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS51bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBPSyh1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlLl9wYXJzZShpbnB1dCk7XG4gICAgfVxuICAgIHVud3JhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5pbm5lclR5cGU7XG4gICAgfVxufVxuWm9kT3B0aW9uYWwuY3JlYXRlID0gKHR5cGUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kT3B0aW9uYWwoe1xuICAgICAgICBpbm5lclR5cGU6IHR5cGUsXG4gICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kT3B0aW9uYWwsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kTnVsbGFibGUgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkVHlwZSA9IHRoaXMuX2dldFR5cGUoaW5wdXQpO1xuICAgICAgICBpZiAocGFyc2VkVHlwZSA9PT0gWm9kUGFyc2VkVHlwZS5udWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gT0sobnVsbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5pbm5lclR5cGUuX3BhcnNlKGlucHV0KTtcbiAgICB9XG4gICAgdW53cmFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmLmlubmVyVHlwZTtcbiAgICB9XG59XG5ab2ROdWxsYWJsZS5jcmVhdGUgPSAodHlwZSwgcGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2ROdWxsYWJsZSh7XG4gICAgICAgIGlubmVyVHlwZTogdHlwZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2ROdWxsYWJsZSxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2REZWZhdWx0IGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBsZXQgZGF0YSA9IGN0eC5kYXRhO1xuICAgICAgICBpZiAoY3R4LnBhcnNlZFR5cGUgPT09IFpvZFBhcnNlZFR5cGUudW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBkYXRhID0gdGhpcy5fZGVmLmRlZmF1bHRWYWx1ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlLl9wYXJzZSh7XG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgcGF0aDogY3R4LnBhdGgsXG4gICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJlbW92ZURlZmF1bHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlO1xuICAgIH1cbn1cblpvZERlZmF1bHQuY3JlYXRlID0gKHR5cGUsIHBhcmFtcykgPT4ge1xuICAgIHJldHVybiBuZXcgWm9kRGVmYXVsdCh7XG4gICAgICAgIGlubmVyVHlwZTogdHlwZSxcbiAgICAgICAgdHlwZU5hbWU6IFpvZEZpcnN0UGFydHlUeXBlS2luZC5ab2REZWZhdWx0LFxuICAgICAgICBkZWZhdWx0VmFsdWU6IHR5cGVvZiBwYXJhbXMuZGVmYXVsdCA9PT0gXCJmdW5jdGlvblwiID8gcGFyYW1zLmRlZmF1bHQgOiAoKSA9PiBwYXJhbXMuZGVmYXVsdCxcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjbGFzcyBab2RDYXRjaCBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCB7IGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgLy8gbmV3Q3R4IGlzIHVzZWQgdG8gbm90IGNvbGxlY3QgaXNzdWVzIGZyb20gaW5uZXIgdHlwZXMgaW4gY3R4XG4gICAgICAgIGNvbnN0IG5ld0N0eCA9IHtcbiAgICAgICAgICAgIC4uLmN0eCxcbiAgICAgICAgICAgIGNvbW1vbjoge1xuICAgICAgICAgICAgICAgIC4uLmN0eC5jb21tb24sXG4gICAgICAgICAgICAgICAgaXNzdWVzOiBbXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2RlZi5pbm5lclR5cGUuX3BhcnNlKHtcbiAgICAgICAgICAgIGRhdGE6IG5ld0N0eC5kYXRhLFxuICAgICAgICAgICAgcGF0aDogbmV3Q3R4LnBhdGgsXG4gICAgICAgICAgICBwYXJlbnQ6IHtcbiAgICAgICAgICAgICAgICAuLi5uZXdDdHgsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGlzQXN5bmMocmVzdWx0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IFwidmFsaWRcIixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHJlc3VsdC5zdGF0dXMgPT09IFwidmFsaWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgPyByZXN1bHQudmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgIDogdGhpcy5fZGVmLmNhdGNoVmFsdWUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdldCBlcnJvcigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBab2RFcnJvcihuZXdDdHguY29tbW9uLmlzc3Vlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dDogbmV3Q3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN0YXR1czogXCJ2YWxpZFwiLFxuICAgICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQuc3RhdHVzID09PSBcInZhbGlkXCJcbiAgICAgICAgICAgICAgICAgICAgPyByZXN1bHQudmFsdWVcbiAgICAgICAgICAgICAgICAgICAgOiB0aGlzLl9kZWYuY2F0Y2hWYWx1ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBnZXQgZXJyb3IoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBab2RFcnJvcihuZXdDdHguY29tbW9uLmlzc3Vlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IG5ld0N0eC5kYXRhLFxuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmVtb3ZlQ2F0Y2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlO1xuICAgIH1cbn1cblpvZENhdGNoLmNyZWF0ZSA9ICh0eXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZENhdGNoKHtcbiAgICAgICAgaW5uZXJUeXBlOiB0eXBlLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZENhdGNoLFxuICAgICAgICBjYXRjaFZhbHVlOiB0eXBlb2YgcGFyYW1zLmNhdGNoID09PSBcImZ1bmN0aW9uXCIgPyBwYXJhbXMuY2F0Y2ggOiAoKSA9PiBwYXJhbXMuY2F0Y2gsXG4gICAgICAgIC4uLnByb2Nlc3NDcmVhdGVQYXJhbXMocGFyYW1zKSxcbiAgICB9KTtcbn07XG5leHBvcnQgY2xhc3MgWm9kTmFOIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZFR5cGUgPSB0aGlzLl9nZXRUeXBlKGlucHV0KTtcbiAgICAgICAgaWYgKHBhcnNlZFR5cGUgIT09IFpvZFBhcnNlZFR5cGUubmFuKSB7XG4gICAgICAgICAgICBjb25zdCBjdHggPSB0aGlzLl9nZXRPclJldHVybkN0eChpbnB1dCk7XG4gICAgICAgICAgICBhZGRJc3N1ZVRvQ29udGV4dChjdHgsIHtcbiAgICAgICAgICAgICAgICBjb2RlOiBab2RJc3N1ZUNvZGUuaW52YWxpZF90eXBlLFxuICAgICAgICAgICAgICAgIGV4cGVjdGVkOiBab2RQYXJzZWRUeXBlLm5hbixcbiAgICAgICAgICAgICAgICByZWNlaXZlZDogY3R4LnBhcnNlZFR5cGUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBJTlZBTElEO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN0YXR1czogXCJ2YWxpZFwiLCB2YWx1ZTogaW5wdXQuZGF0YSB9O1xuICAgIH1cbn1cblpvZE5hTi5jcmVhdGUgPSAocGFyYW1zKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBab2ROYU4oe1xuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZE5hTixcbiAgICAgICAgLi4ucHJvY2Vzc0NyZWF0ZVBhcmFtcyhwYXJhbXMpLFxuICAgIH0pO1xufTtcbmV4cG9ydCBjb25zdCBCUkFORCA9IFN5bWJvbChcInpvZF9icmFuZFwiKTtcbmV4cG9ydCBjbGFzcyBab2RCcmFuZGVkIGV4dGVuZHMgWm9kVHlwZSB7XG4gICAgX3BhcnNlKGlucHV0KSB7XG4gICAgICAgIGNvbnN0IHsgY3R4IH0gPSB0aGlzLl9wcm9jZXNzSW5wdXRQYXJhbXMoaW5wdXQpO1xuICAgICAgICBjb25zdCBkYXRhID0gY3R4LmRhdGE7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYudHlwZS5fcGFyc2Uoe1xuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgcGFyZW50OiBjdHgsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICB1bndyYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYudHlwZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgWm9kUGlwZWxpbmUgZXh0ZW5kcyBab2RUeXBlIHtcbiAgICBfcGFyc2UoaW5wdXQpIHtcbiAgICAgICAgY29uc3QgeyBzdGF0dXMsIGN0eCB9ID0gdGhpcy5fcHJvY2Vzc0lucHV0UGFyYW1zKGlucHV0KTtcbiAgICAgICAgaWYgKGN0eC5jb21tb24uYXN5bmMpIHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZUFzeW5jID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluUmVzdWx0ID0gYXdhaXQgdGhpcy5fZGVmLmluLl9wYXJzZUFzeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogY3R4LmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoaW5SZXN1bHQuc3RhdHVzID09PSBcImFib3J0ZWRcIilcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICAgICAgaWYgKGluUmVzdWx0LnN0YXR1cyA9PT0gXCJkaXJ0eVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1cy5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gRElSVFkoaW5SZXN1bHQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlZi5vdXQuX3BhcnNlQXN5bmMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogaW5SZXN1bHQudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudDogY3R4LFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZUFzeW5jKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBpblJlc3VsdCA9IHRoaXMuX2RlZi5pbi5fcGFyc2VTeW5jKHtcbiAgICAgICAgICAgICAgICBkYXRhOiBjdHguZGF0YSxcbiAgICAgICAgICAgICAgICBwYXRoOiBjdHgucGF0aCxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGluUmVzdWx0LnN0YXR1cyA9PT0gXCJhYm9ydGVkXCIpXG4gICAgICAgICAgICAgICAgcmV0dXJuIElOVkFMSUQ7XG4gICAgICAgICAgICBpZiAoaW5SZXN1bHQuc3RhdHVzID09PSBcImRpcnR5XCIpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMuZGlydHkoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IFwiZGlydHlcIixcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGluUmVzdWx0LnZhbHVlLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZGVmLm91dC5fcGFyc2VTeW5jKHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogaW5SZXN1bHQudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGN0eC5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IGN0eCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBab2RQaXBlbGluZSh7XG4gICAgICAgICAgICBpbjogYSxcbiAgICAgICAgICAgIG91dDogYixcbiAgICAgICAgICAgIHR5cGVOYW1lOiBab2RGaXJzdFBhcnR5VHlwZUtpbmQuWm9kUGlwZWxpbmUsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBab2RSZWFkb25seSBleHRlbmRzIFpvZFR5cGUge1xuICAgIF9wYXJzZShpbnB1dCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9kZWYuaW5uZXJUeXBlLl9wYXJzZShpbnB1dCk7XG4gICAgICAgIGNvbnN0IGZyZWV6ZSA9IChkYXRhKSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNWYWxpZChkYXRhKSkge1xuICAgICAgICAgICAgICAgIGRhdGEudmFsdWUgPSBPYmplY3QuZnJlZXplKGRhdGEudmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBpc0FzeW5jKHJlc3VsdCkgPyByZXN1bHQudGhlbigoZGF0YSkgPT4gZnJlZXplKGRhdGEpKSA6IGZyZWV6ZShyZXN1bHQpO1xuICAgIH1cbiAgICB1bndyYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZWYuaW5uZXJUeXBlO1xuICAgIH1cbn1cblpvZFJlYWRvbmx5LmNyZWF0ZSA9ICh0eXBlLCBwYXJhbXMpID0+IHtcbiAgICByZXR1cm4gbmV3IFpvZFJlYWRvbmx5KHtcbiAgICAgICAgaW5uZXJUeXBlOiB0eXBlLFxuICAgICAgICB0eXBlTmFtZTogWm9kRmlyc3RQYXJ0eVR5cGVLaW5kLlpvZFJlYWRvbmx5LFxuICAgICAgICAuLi5wcm9jZXNzQ3JlYXRlUGFyYW1zKHBhcmFtcyksXG4gICAgfSk7XG59O1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8vLy8vLy8vLyAgICAgICAgICAgICAgICAgICAgLy8vLy8vLy8vL1xuLy8vLy8vLy8vLyAgICAgIHouY3VzdG9tICAgICAgLy8vLy8vLy8vL1xuLy8vLy8vLy8vLyAgICAgICAgICAgICAgICAgICAgLy8vLy8vLy8vL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuZnVuY3Rpb24gY2xlYW5QYXJhbXMocGFyYW1zLCBkYXRhKSB7XG4gICAgY29uc3QgcCA9IHR5cGVvZiBwYXJhbXMgPT09IFwiZnVuY3Rpb25cIiA/IHBhcmFtcyhkYXRhKSA6IHR5cGVvZiBwYXJhbXMgPT09IFwic3RyaW5nXCIgPyB7IG1lc3NhZ2U6IHBhcmFtcyB9IDogcGFyYW1zO1xuICAgIGNvbnN0IHAyID0gdHlwZW9mIHAgPT09IFwic3RyaW5nXCIgPyB7IG1lc3NhZ2U6IHAgfSA6IHA7XG4gICAgcmV0dXJuIHAyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGN1c3RvbShjaGVjaywgX3BhcmFtcyA9IHt9LCBcbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqXG4gKiBQYXNzIGBmYXRhbGAgaW50byB0aGUgcGFyYW1zIG9iamVjdCBpbnN0ZWFkOlxuICpcbiAqIGBgYHRzXG4gKiB6LnN0cmluZygpLmN1c3RvbSgodmFsKSA9PiB2YWwubGVuZ3RoID4gNSwgeyBmYXRhbDogZmFsc2UgfSlcbiAqIGBgYFxuICpcbiAqL1xuZmF0YWwpIHtcbiAgICBpZiAoY2hlY2spXG4gICAgICAgIHJldHVybiBab2RBbnkuY3JlYXRlKCkuc3VwZXJSZWZpbmUoKGRhdGEsIGN0eCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgciA9IGNoZWNrKGRhdGEpO1xuICAgICAgICAgICAgaWYgKHIgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHIudGhlbigocikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IGNsZWFuUGFyYW1zKF9wYXJhbXMsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgX2ZhdGFsID0gcGFyYW1zLmZhdGFsID8/IGZhdGFsID8/IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguYWRkSXNzdWUoeyBjb2RlOiBcImN1c3RvbVwiLCAuLi5wYXJhbXMsIGZhdGFsOiBfZmF0YWwgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IGNsZWFuUGFyYW1zKF9wYXJhbXMsIGRhdGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9mYXRhbCA9IHBhcmFtcy5mYXRhbCA/PyBmYXRhbCA/PyB0cnVlO1xuICAgICAgICAgICAgICAgIGN0eC5hZGRJc3N1ZSh7IGNvZGU6IFwiY3VzdG9tXCIsIC4uLnBhcmFtcywgZmF0YWw6IF9mYXRhbCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIFpvZEFueS5jcmVhdGUoKTtcbn1cbmV4cG9ydCB7IFpvZFR5cGUgYXMgU2NoZW1hLCBab2RUeXBlIGFzIFpvZFNjaGVtYSB9O1xuZXhwb3J0IGNvbnN0IGxhdGUgPSB7XG4gICAgb2JqZWN0OiBab2RPYmplY3QubGF6eWNyZWF0ZSxcbn07XG5leHBvcnQgdmFyIFpvZEZpcnN0UGFydHlUeXBlS2luZDtcbihmdW5jdGlvbiAoWm9kRmlyc3RQYXJ0eVR5cGVLaW5kKSB7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kU3RyaW5nXCJdID0gXCJab2RTdHJpbmdcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2ROdW1iZXJcIl0gPSBcIlpvZE51bWJlclwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZE5hTlwiXSA9IFwiWm9kTmFOXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kQmlnSW50XCJdID0gXCJab2RCaWdJbnRcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RCb29sZWFuXCJdID0gXCJab2RCb29sZWFuXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kRGF0ZVwiXSA9IFwiWm9kRGF0ZVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFN5bWJvbFwiXSA9IFwiWm9kU3ltYm9sXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kVW5kZWZpbmVkXCJdID0gXCJab2RVbmRlZmluZWRcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2ROdWxsXCJdID0gXCJab2ROdWxsXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kQW55XCJdID0gXCJab2RBbnlcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RVbmtub3duXCJdID0gXCJab2RVbmtub3duXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTmV2ZXJcIl0gPSBcIlpvZE5ldmVyXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kVm9pZFwiXSA9IFwiWm9kVm9pZFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZEFycmF5XCJdID0gXCJab2RBcnJheVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZE9iamVjdFwiXSA9IFwiWm9kT2JqZWN0XCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kVW5pb25cIl0gPSBcIlpvZFVuaW9uXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kRGlzY3JpbWluYXRlZFVuaW9uXCJdID0gXCJab2REaXNjcmltaW5hdGVkVW5pb25cIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RJbnRlcnNlY3Rpb25cIl0gPSBcIlpvZEludGVyc2VjdGlvblwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFR1cGxlXCJdID0gXCJab2RUdXBsZVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFJlY29yZFwiXSA9IFwiWm9kUmVjb3JkXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTWFwXCJdID0gXCJab2RNYXBcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RTZXRcIl0gPSBcIlpvZFNldFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZEZ1bmN0aW9uXCJdID0gXCJab2RGdW5jdGlvblwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZExhenlcIl0gPSBcIlpvZExhenlcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RMaXRlcmFsXCJdID0gXCJab2RMaXRlcmFsXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kRW51bVwiXSA9IFwiWm9kRW51bVwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZEVmZmVjdHNcIl0gPSBcIlpvZEVmZmVjdHNcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2ROYXRpdmVFbnVtXCJdID0gXCJab2ROYXRpdmVFbnVtXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kT3B0aW9uYWxcIl0gPSBcIlpvZE9wdGlvbmFsXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kTnVsbGFibGVcIl0gPSBcIlpvZE51bGxhYmxlXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kRGVmYXVsdFwiXSA9IFwiWm9kRGVmYXVsdFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZENhdGNoXCJdID0gXCJab2RDYXRjaFwiO1xuICAgIFpvZEZpcnN0UGFydHlUeXBlS2luZFtcIlpvZFByb21pc2VcIl0gPSBcIlpvZFByb21pc2VcIjtcbiAgICBab2RGaXJzdFBhcnR5VHlwZUtpbmRbXCJab2RCcmFuZGVkXCJdID0gXCJab2RCcmFuZGVkXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kUGlwZWxpbmVcIl0gPSBcIlpvZFBpcGVsaW5lXCI7XG4gICAgWm9kRmlyc3RQYXJ0eVR5cGVLaW5kW1wiWm9kUmVhZG9ubHlcIl0gPSBcIlpvZFJlYWRvbmx5XCI7XG59KShab2RGaXJzdFBhcnR5VHlwZUtpbmQgfHwgKFpvZEZpcnN0UGFydHlUeXBlS2luZCA9IHt9KSk7XG4vLyByZXF1aXJlcyBUUyA0LjQrXG5jbGFzcyBDbGFzcyB7XG4gICAgY29uc3RydWN0b3IoLi4uXykgeyB9XG59XG5jb25zdCBpbnN0YW5jZU9mVHlwZSA9IChcbi8vIGNvbnN0IGluc3RhbmNlT2ZUeXBlID0gPFQgZXh0ZW5kcyBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KFxuY2xzLCBwYXJhbXMgPSB7XG4gICAgbWVzc2FnZTogYElucHV0IG5vdCBpbnN0YW5jZSBvZiAke2Nscy5uYW1lfWAsXG59KSA9PiBjdXN0b20oKGRhdGEpID0+IGRhdGEgaW5zdGFuY2VvZiBjbHMsIHBhcmFtcyk7XG5jb25zdCBzdHJpbmdUeXBlID0gWm9kU3RyaW5nLmNyZWF0ZTtcbmNvbnN0IG51bWJlclR5cGUgPSBab2ROdW1iZXIuY3JlYXRlO1xuY29uc3QgbmFuVHlwZSA9IFpvZE5hTi5jcmVhdGU7XG5jb25zdCBiaWdJbnRUeXBlID0gWm9kQmlnSW50LmNyZWF0ZTtcbmNvbnN0IGJvb2xlYW5UeXBlID0gWm9kQm9vbGVhbi5jcmVhdGU7XG5jb25zdCBkYXRlVHlwZSA9IFpvZERhdGUuY3JlYXRlO1xuY29uc3Qgc3ltYm9sVHlwZSA9IFpvZFN5bWJvbC5jcmVhdGU7XG5jb25zdCB1bmRlZmluZWRUeXBlID0gWm9kVW5kZWZpbmVkLmNyZWF0ZTtcbmNvbnN0IG51bGxUeXBlID0gWm9kTnVsbC5jcmVhdGU7XG5jb25zdCBhbnlUeXBlID0gWm9kQW55LmNyZWF0ZTtcbmNvbnN0IHVua25vd25UeXBlID0gWm9kVW5rbm93bi5jcmVhdGU7XG5jb25zdCBuZXZlclR5cGUgPSBab2ROZXZlci5jcmVhdGU7XG5jb25zdCB2b2lkVHlwZSA9IFpvZFZvaWQuY3JlYXRlO1xuY29uc3QgYXJyYXlUeXBlID0gWm9kQXJyYXkuY3JlYXRlO1xuY29uc3Qgb2JqZWN0VHlwZSA9IFpvZE9iamVjdC5jcmVhdGU7XG5jb25zdCBzdHJpY3RPYmplY3RUeXBlID0gWm9kT2JqZWN0LnN0cmljdENyZWF0ZTtcbmNvbnN0IHVuaW9uVHlwZSA9IFpvZFVuaW9uLmNyZWF0ZTtcbmNvbnN0IGRpc2NyaW1pbmF0ZWRVbmlvblR5cGUgPSBab2REaXNjcmltaW5hdGVkVW5pb24uY3JlYXRlO1xuY29uc3QgaW50ZXJzZWN0aW9uVHlwZSA9IFpvZEludGVyc2VjdGlvbi5jcmVhdGU7XG5jb25zdCB0dXBsZVR5cGUgPSBab2RUdXBsZS5jcmVhdGU7XG5jb25zdCByZWNvcmRUeXBlID0gWm9kUmVjb3JkLmNyZWF0ZTtcbmNvbnN0IG1hcFR5cGUgPSBab2RNYXAuY3JlYXRlO1xuY29uc3Qgc2V0VHlwZSA9IFpvZFNldC5jcmVhdGU7XG5jb25zdCBmdW5jdGlvblR5cGUgPSBab2RGdW5jdGlvbi5jcmVhdGU7XG5jb25zdCBsYXp5VHlwZSA9IFpvZExhenkuY3JlYXRlO1xuY29uc3QgbGl0ZXJhbFR5cGUgPSBab2RMaXRlcmFsLmNyZWF0ZTtcbmNvbnN0IGVudW1UeXBlID0gWm9kRW51bS5jcmVhdGU7XG5jb25zdCBuYXRpdmVFbnVtVHlwZSA9IFpvZE5hdGl2ZUVudW0uY3JlYXRlO1xuY29uc3QgcHJvbWlzZVR5cGUgPSBab2RQcm9taXNlLmNyZWF0ZTtcbmNvbnN0IGVmZmVjdHNUeXBlID0gWm9kRWZmZWN0cy5jcmVhdGU7XG5jb25zdCBvcHRpb25hbFR5cGUgPSBab2RPcHRpb25hbC5jcmVhdGU7XG5jb25zdCBudWxsYWJsZVR5cGUgPSBab2ROdWxsYWJsZS5jcmVhdGU7XG5jb25zdCBwcmVwcm9jZXNzVHlwZSA9IFpvZEVmZmVjdHMuY3JlYXRlV2l0aFByZXByb2Nlc3M7XG5jb25zdCBwaXBlbGluZVR5cGUgPSBab2RQaXBlbGluZS5jcmVhdGU7XG5jb25zdCBvc3RyaW5nID0gKCkgPT4gc3RyaW5nVHlwZSgpLm9wdGlvbmFsKCk7XG5jb25zdCBvbnVtYmVyID0gKCkgPT4gbnVtYmVyVHlwZSgpLm9wdGlvbmFsKCk7XG5jb25zdCBvYm9vbGVhbiA9ICgpID0+IGJvb2xlYW5UeXBlKCkub3B0aW9uYWwoKTtcbmV4cG9ydCBjb25zdCBjb2VyY2UgPSB7XG4gICAgc3RyaW5nOiAoKGFyZykgPT4gWm9kU3RyaW5nLmNyZWF0ZSh7IC4uLmFyZywgY29lcmNlOiB0cnVlIH0pKSxcbiAgICBudW1iZXI6ICgoYXJnKSA9PiBab2ROdW1iZXIuY3JlYXRlKHsgLi4uYXJnLCBjb2VyY2U6IHRydWUgfSkpLFxuICAgIGJvb2xlYW46ICgoYXJnKSA9PiBab2RCb29sZWFuLmNyZWF0ZSh7XG4gICAgICAgIC4uLmFyZyxcbiAgICAgICAgY29lcmNlOiB0cnVlLFxuICAgIH0pKSxcbiAgICBiaWdpbnQ6ICgoYXJnKSA9PiBab2RCaWdJbnQuY3JlYXRlKHsgLi4uYXJnLCBjb2VyY2U6IHRydWUgfSkpLFxuICAgIGRhdGU6ICgoYXJnKSA9PiBab2REYXRlLmNyZWF0ZSh7IC4uLmFyZywgY29lcmNlOiB0cnVlIH0pKSxcbn07XG5leHBvcnQgeyBhbnlUeXBlIGFzIGFueSwgYXJyYXlUeXBlIGFzIGFycmF5LCBiaWdJbnRUeXBlIGFzIGJpZ2ludCwgYm9vbGVhblR5cGUgYXMgYm9vbGVhbiwgZGF0ZVR5cGUgYXMgZGF0ZSwgZGlzY3JpbWluYXRlZFVuaW9uVHlwZSBhcyBkaXNjcmltaW5hdGVkVW5pb24sIGVmZmVjdHNUeXBlIGFzIGVmZmVjdCwgZW51bVR5cGUgYXMgZW51bSwgZnVuY3Rpb25UeXBlIGFzIGZ1bmN0aW9uLCBpbnN0YW5jZU9mVHlwZSBhcyBpbnN0YW5jZW9mLCBpbnRlcnNlY3Rpb25UeXBlIGFzIGludGVyc2VjdGlvbiwgbGF6eVR5cGUgYXMgbGF6eSwgbGl0ZXJhbFR5cGUgYXMgbGl0ZXJhbCwgbWFwVHlwZSBhcyBtYXAsIG5hblR5cGUgYXMgbmFuLCBuYXRpdmVFbnVtVHlwZSBhcyBuYXRpdmVFbnVtLCBuZXZlclR5cGUgYXMgbmV2ZXIsIG51bGxUeXBlIGFzIG51bGwsIG51bGxhYmxlVHlwZSBhcyBudWxsYWJsZSwgbnVtYmVyVHlwZSBhcyBudW1iZXIsIG9iamVjdFR5cGUgYXMgb2JqZWN0LCBvYm9vbGVhbiwgb251bWJlciwgb3B0aW9uYWxUeXBlIGFzIG9wdGlvbmFsLCBvc3RyaW5nLCBwaXBlbGluZVR5cGUgYXMgcGlwZWxpbmUsIHByZXByb2Nlc3NUeXBlIGFzIHByZXByb2Nlc3MsIHByb21pc2VUeXBlIGFzIHByb21pc2UsIHJlY29yZFR5cGUgYXMgcmVjb3JkLCBzZXRUeXBlIGFzIHNldCwgc3RyaWN0T2JqZWN0VHlwZSBhcyBzdHJpY3RPYmplY3QsIHN0cmluZ1R5cGUgYXMgc3RyaW5nLCBzeW1ib2xUeXBlIGFzIHN5bWJvbCwgZWZmZWN0c1R5cGUgYXMgdHJhbnNmb3JtZXIsIHR1cGxlVHlwZSBhcyB0dXBsZSwgdW5kZWZpbmVkVHlwZSBhcyB1bmRlZmluZWQsIHVuaW9uVHlwZSBhcyB1bmlvbiwgdW5rbm93blR5cGUgYXMgdW5rbm93biwgdm9pZFR5cGUgYXMgdm9pZCwgfTtcbmV4cG9ydCBjb25zdCBORVZFUiA9IElOVkFMSUQ7XG4iLCAiaW1wb3J0IGp3dCBmcm9tICdqc29ud2VidG9rZW4nO1xuaW1wb3J0IHsgZ2V0RmlyZWJhc2VBdXRoIH0gZnJvbSAnLi9maXJlYmFzZS1hZG1pbi5qcyc7XG5pbXBvcnQgeyBnZXRVc2VyQnlJZCwgZ2V0VXNlckJ5TG9jYWxBdXRoIH0gZnJvbSAnLi9xdWVyaWVzLmpzJztcbmltcG9ydCB0eXBlIHsgUmVxdWVzdCwgUmVzcG9uc2UsIE5leHRGdW5jdGlvbiB9IGZyb20gJ2V4cHJlc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhVc2VyIHtcbiAgaWQ6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgcGxhbjogc3RyaW5nO1xuICBjcmVkaXRzQmFsYW5jZTogbnVtYmVyO1xuICBpc0FkbWluOiBib29sZWFuO1xuICBhY2NvdW50U3RhdHVzOiBzdHJpbmc7XG59XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgbmFtZXNwYWNlIEV4cHJlc3Mge1xuICAgIGludGVyZmFjZSBSZXF1ZXN0IHtcbiAgICAgIHVzZXI/OiBBdXRoVXNlcjtcbiAgICB9XG4gIH1cbn1cblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgJiYgIXByb2Nlc3MuZW52LlNFU1NJT05fU0VDUkVUKSB7XG4gIHRocm93IG5ldyBFcnJvcignU0VTU0lPTl9TRUNSRVQgbXVzdCBiZSBzZXQgaW4gcHJvZHVjdGlvbi4nKTtcbn1cblxuY29uc3QgSldUX1NFQ1JFVCA9IHByb2Nlc3MuZW52LlNFU1NJT05fU0VDUkVUID8/ICdkZXZlbG9wbWVudC1vbmx5LXNlY3JldCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduTG9jYWxKd3QodXNlcklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gand0LnNpZ24oeyBzdWI6IHVzZXJJZCwgdHlwZTogJ2xvY2FsJyB9LCBKV1RfU0VDUkVULCB7IGV4cGlyZXNJbjogJzMwZCcgfSk7XG59XG5cbmZ1bmN0aW9uIHZlcmlmeUxvY2FsSnd0KHRva2VuOiBzdHJpbmcpOiB7IHN1Yjogc3RyaW5nIH0gfCBudWxsIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gand0LnZlcmlmeSh0b2tlbiwgSldUX1NFQ1JFVCkgYXMgeyBzdWI6IHN0cmluZyB9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZVVzZXIodG9rZW46IHN0cmluZyk6IFByb21pc2U8QXV0aFVzZXIgfCBudWxsPiB7XG4gIGNvbnN0IGNvbmZpZ3VyZWRBZG1pbiA9IHByb2Nlc3MuZW52LkFETUlOX0VNQUlMPy50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgLy8gVHJ5IGxvY2FsIEpXVCBmaXJzdFxuICBjb25zdCBsb2NhbFBheWxvYWQgPSB2ZXJpZnlMb2NhbEp3dCh0b2tlbik7XG4gIGlmIChsb2NhbFBheWxvYWQpIHtcbiAgICBjb25zdCByb3cgPSBhd2FpdCBnZXRVc2VyQnlJZChsb2NhbFBheWxvYWQuc3ViKTtcbiAgICBpZiAoIXJvdykgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHsgaWQ6IHJvdy5pZCwgZW1haWw6IHJvdy5lbWFpbCwgcGxhbjogcm93LnBsYW4sIGNyZWRpdHNCYWxhbmNlOiByb3cuY3JlZGl0c19iYWxhbmNlLCBpc0FkbWluOiByb3cuaXNfYWRtaW4gfHwgcm93LmVtYWlsLnRvTG93ZXJDYXNlKCkgPT09IGNvbmZpZ3VyZWRBZG1pbiwgYWNjb3VudFN0YXR1czogcm93LmFjY291bnRfc3RhdHVzIH07XG4gIH1cblxuICAvLyBUcnkgRmlyZWJhc2UgdG9rZW5cbiAgY29uc3QgYXV0aCA9IGdldEZpcmViYXNlQXV0aCgpO1xuICBpZiAoIWF1dGgpIHJldHVybiBudWxsO1xuICB0cnkge1xuICAgIGNvbnN0IGRlY29kZWQgPSBhd2FpdCBhdXRoLnZlcmlmeUlkVG9rZW4odG9rZW4pO1xuICAgIC8vIFdlIG5lZWQgdG8gZ2V0IHRoZSB1c2VyIGJ5IGZpcmViYXNlIHVpZFxuICAgIGNvbnN0IHBvb2wgPSBhd2FpdCBpbXBvcnQoJy4vcG9vbC5qcycpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBvb2wucXVlcnk8aW1wb3J0KCcuL3F1ZXJpZXMuanMnKS5Vc2VyUm93PihcbiAgICAgICdTRUxFQ1QgKiBGUk9NIHVzZXJzIFdIRVJFIGZpcmViYXNlX3VpZD0kMSBMSU1JVCAxJyxcbiAgICAgIFtkZWNvZGVkLnVpZF1cbiAgICApO1xuICAgIGNvbnN0IHVzZXIgPSByZXN1bHQucm93c1swXTtcbiAgICBpZiAoIXVzZXIpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB7IGlkOiB1c2VyLmlkLCBlbWFpbDogdXNlci5lbWFpbCwgcGxhbjogdXNlci5wbGFuLCBjcmVkaXRzQmFsYW5jZTogdXNlci5jcmVkaXRzX2JhbGFuY2UsIGlzQWRtaW46IHVzZXIuaXNfYWRtaW4gfHwgdXNlci5lbWFpbC50b0xvd2VyQ2FzZSgpID09PSBjb25maWd1cmVkQWRtaW4sIGFjY291bnRTdGF0dXM6IHVzZXIuYWNjb3VudF9zdGF0dXMgfTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVpcmVBdXRoKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gIGNvbnN0IGhlYWRlciA9IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG4gIGlmICghaGVhZGVyPy5zdGFydHNXaXRoKCdCZWFyZXIgJykpIHtcbiAgICByZXMuc3RhdHVzKDQwMSkuanNvbih7IGVycm9yOiAnTWlzc2luZyBvciBpbnZhbGlkIEF1dGhvcml6YXRpb24gaGVhZGVyLicsIGNvZGU6ICdVTkFVVEhPUklaRUQnIH0pO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCB0b2tlbiA9IGhlYWRlci5zbGljZSg3KTtcbiAgY29uc3QgdXNlciA9IGF3YWl0IHJlc29sdmVVc2VyKHRva2VuKTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgcmVzLnN0YXR1cyg0MDEpLmpzb24oeyBlcnJvcjogJ1Rva2VuIGludmFsaWQgb3IgZXhwaXJlZC4nLCBjb2RlOiAnVU5BVVRIT1JJWkVEJyB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgcmVxLnVzZXIgPSB1c2VyO1xuICBpZiAodXNlci5hY2NvdW50U3RhdHVzICE9PSAnYWN0aXZlJykge1xuICAgIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICdUaGlzIGFjY291bnQgaXMgY3VycmVudGx5IHVuYXZhaWxhYmxlLiBQbGVhc2UgY29udGFjdCBzdXBwb3J0LicsIGNvZGU6ICdBQ0NPVU5UX1NVU1BFTkRFRCcgfSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIG5leHQoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVpcmVBZG1pbihyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICBhd2FpdCByZXF1aXJlQXV0aChyZXEsIHJlcywgKCkgPT4ge1xuICAgIGlmICghcmVxLnVzZXI/LmlzQWRtaW4pIHtcbiAgICAgIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6ICdBZG1pbmlzdHJhdG9yIGFjY2VzcyBpcyByZXF1aXJlZC4nLCBjb2RlOiAnQURNSU5fUkVRVUlSRUQnIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBuZXh0KCk7XG4gIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdHJ5QXV0aChyZXE6IFJlcXVlc3QsIF9yZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgY29uc3QgaGVhZGVyID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcbiAgaWYgKGhlYWRlcj8uc3RhcnRzV2l0aCgnQmVhcmVyICcpKSB7XG4gICAgY29uc3QgdG9rZW4gPSBoZWFkZXIuc2xpY2UoNyk7XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHJlc29sdmVVc2VyKHRva2VuKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICBpZiAodXNlcikgcmVxLnVzZXIgPSB1c2VyO1xuICB9XG4gIG5leHQoKTtcbn1cbiIsICJpbXBvcnQgeyBhcHBsaWNhdGlvbkRlZmF1bHQsIGNlcnQsIGdldEFwcCwgZ2V0QXBwcywgaW5pdGlhbGl6ZUFwcCwgdHlwZSBDcmVkZW50aWFsIH0gZnJvbSAnZmlyZWJhc2UtYWRtaW4vYXBwJztcbmltcG9ydCB7IGdldEF1dGgsIHR5cGUgQXV0aCB9IGZyb20gJ2ZpcmViYXNlLWFkbWluL2F1dGgnO1xuXG5sZXQgX2F1dGg6IEF1dGggfCBudWxsID0gbnVsbDtcbmxldCBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZpcmViYXNlQXV0aCgpOiBBdXRoIHwgbnVsbCB7XG4gIGlmIChfaW5pdGlhbGl6ZWQpIHJldHVybiBfYXV0aDtcbiAgX2luaXRpYWxpemVkID0gdHJ1ZTtcblxuICBjb25zdCBjcmVkID0gcHJvY2Vzcy5lbnYuRklSRUJBU0VfQURNSU5fQ1JFREVOVElBTF9KU09OO1xuICBjb25zdCBwcm9qZWN0SWQgPSBwcm9jZXNzLmVudi5GSVJFQkFTRV9BRE1JTl9QUk9KRUNUX0lEO1xuICBjb25zdCBjbGllbnRFbWFpbCA9IHByb2Nlc3MuZW52LkZJUkVCQVNFX0FETUlOX0NMSUVOVF9FTUFJTDtcbiAgY29uc3QgcHJpdmF0ZUtleSA9IHByb2Nlc3MuZW52LkZJUkVCQVNFX0FETUlOX1BSSVZBVEVfS0VZPy5yZXBsYWNlKC9cXFxcbi9nLCAnXFxuJyk7XG5cbiAgaWYgKCFjcmVkICYmICFwcm9qZWN0SWQgJiYgIShjbGllbnRFbWFpbCAmJiBwcml2YXRlS2V5KSkge1xuICAgIGNvbnNvbGUud2FybignW2ZpcmViYXNlLWFkbWluXSBOb3QgY29uZmlndXJlZCBcdTIwMTQgRmlyZWJhc2UgYXV0aCB2ZXJpZmljYXRpb24gZGlzYWJsZWQuJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB0cnkge1xuICAgIGxldCBjcmVkZW50aWFsOiBDcmVkZW50aWFsO1xuICAgIGlmIChjcmVkKSB7XG4gICAgICBjcmVkZW50aWFsID0gY2VydChKU09OLnBhcnNlKGNyZWQpKTtcbiAgICB9IGVsc2UgaWYgKHByb2plY3RJZCAmJiBjbGllbnRFbWFpbCAmJiBwcml2YXRlS2V5KSB7XG4gICAgICBjcmVkZW50aWFsID0gY2VydCh7IHByb2plY3RJZCwgY2xpZW50RW1haWwsIHByaXZhdGVLZXkgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNyZWRlbnRpYWwgPSBhcHBsaWNhdGlvbkRlZmF1bHQoKTtcbiAgICB9XG5cbiAgICBjb25zdCBhcHAgPSBnZXRBcHBzKCkubGVuZ3RoID8gZ2V0QXBwKCkgOiBpbml0aWFsaXplQXBwKHsgY3JlZGVudGlhbCwgcHJvamVjdElkIH0pO1xuICAgIF9hdXRoID0gZ2V0QXV0aChhcHApO1xuICAgIHJldHVybiBfYXV0aDtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignW2ZpcmViYXNlLWFkbWluXSBJbml0IGZhaWxlZDonLCAoZXJyIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwgImltcG9ydCB7IHBvb2wsIHF1ZXJ5IH0gZnJvbSAnLi9wb29sLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBVc2VyUm93IHtcbiAgaWQ6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgZmlyZWJhc2VfdWlkOiBzdHJpbmcgfCBudWxsO1xuICBwbGFuOiBzdHJpbmc7XG4gIGNyZWRpdHNfYmFsYW5jZTogbnVtYmVyO1xuICBzdHJpcGVfY3VzdG9tZXJfaWQ6IHN0cmluZyB8IG51bGw7XG4gIHBhc3N3b3JkX2hhc2g6IHN0cmluZyB8IG51bGw7XG4gIGlzX2FkbWluOiBib29sZWFuO1xuICBhY2NvdW50X3N0YXR1czogc3RyaW5nO1xuICBlbWFpbF92ZXJpZmllZDogYm9vbGVhbjtcbiAgY3JlYXRlZF9hdDogRGF0ZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBKb2JSb3cge1xuICBpZDogc3RyaW5nO1xuICB1c2VyX2lkOiBzdHJpbmcgfCBudWxsO1xuICBzb3VyY2VfdXJsOiBzdHJpbmc7XG4gIHN0YXR1czogc3RyaW5nO1xuICBwcm9ncmVzczogbnVtYmVyO1xuICBtb2RlOiBzdHJpbmc7XG4gIHZpYmVfYnJpZWY6IHN0cmluZyB8IG51bGw7XG4gIGNhcHR1cmVfbWV0YWRhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbDtcbiAgc3Rvcnlib2FyZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsO1xuICB3b3JrZmxvd19zdGF0ZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsO1xuICBzdGF0dXNfbWVzc2FnZTogc3RyaW5nIHwgbnVsbDtcbiAgZXRhX3NlY29uZHM6IG51bWJlciB8IG51bGw7XG4gIGNyZWRpdHNfc3BlbnQ6IG51bWJlcjtcbiAgZXJyb3JfbWVzc2FnZTogc3RyaW5nIHwgbnVsbDtcbiAgdGl0bGU6IHN0cmluZyB8IG51bGw7XG4gIHBpbm5lZDogYm9vbGVhbjtcbiAgZGVsZXRlZF9hdDogRGF0ZSB8IG51bGw7XG4gIHBhcmVudF9qb2JfaWQ6IHN0cmluZyB8IG51bGw7XG4gIGNhbmNlbF9yZXF1ZXN0ZWQ6IGJvb2xlYW47XG4gIGNyZWF0ZWRfYXQ6IERhdGU7XG4gIHVwZGF0ZWRfYXQ6IERhdGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXNzZXRSb3cge1xuICBpZDogc3RyaW5nO1xuICBqb2JfaWQ6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xuICBzdG9yYWdlX3VybDogc3RyaW5nO1xuICBhc3BlY3RfcmF0aW86IHN0cmluZyB8IG51bGw7XG4gIHdhdGVybWFya2VkOiBib29sZWFuO1xuICBkb3dubG9hZGFibGU6IGJvb2xlYW47XG4gIGNyZWF0ZWRfYXQ6IERhdGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSm9iTWVzc2FnZVJvdyB7XG4gIGlkOiBzdHJpbmc7XG4gIGpvYl9pZDogc3RyaW5nO1xuICByb2xlOiAndXNlcicgfCAnYXNzaXN0YW50JyB8ICdzeXN0ZW0nO1xuICBraW5kOiBzdHJpbmc7XG4gIGNvbnRlbnQ6IHN0cmluZztcbiAgcGF5bG9hZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsO1xuICBjcmVhdGVkX2F0OiBEYXRlO1xufVxuXG4vLyAtLS0tIFVzZXJzIC0tLS1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldE9yQ3JlYXRlVXNlcihcbiAgZmlyZWJhc2VVaWQ6IHN0cmluZyxcbiAgZW1haWw6IHN0cmluZyxcbiAgYWRtaW5FbWFpbD86IHN0cmluZ1xuKTogUHJvbWlzZTxVc2VyUm93PiB7XG4gIGNvbnN0IGlzQWRtaW4gPSBhZG1pbkVtYWlsICYmIGVtYWlsLnRvTG93ZXJDYXNlKCkgPT09IGFkbWluRW1haWwudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxVc2VyUm93PihcbiAgICBgSU5TRVJUIElOVE8gdXNlcnMgKGZpcmViYXNlX3VpZCwgZW1haWwsIHBsYW4sIGNyZWRpdHNfYmFsYW5jZSwgaXNfYWRtaW4pXG4gICAgIFZBTFVFUyAoJDEsICQyLCAkMywgJDQsICQ1KVxuICAgICBPTiBDT05GTElDVCAoZmlyZWJhc2VfdWlkKSBETyBVUERBVEVcbiAgICAgICBTRVQgZW1haWwgPSBFWENMVURFRC5lbWFpbCwgaXNfYWRtaW4gPSB1c2Vycy5pc19hZG1pbiBPUiBFWENMVURFRC5pc19hZG1pblxuICAgICBSRVRVUk5JTkcgKmAsXG4gICAgW2ZpcmViYXNlVWlkLCBlbWFpbCwgaXNBZG1pbiA/ICdhZ2VuY3knIDogJ2ZyZWUnLCBpc0FkbWluID8gOTk5OTk5IDogMCwgQm9vbGVhbihpc0FkbWluKV1cbiAgKTtcbiAgY29uc3QgdXNlciA9IHJvd3NbMF07XG4gIC8vIElmIGFkbWluIGFuZCBub3QgYWxyZWFkeSBvbiBhZ2VuY3kvOTk5OTk5LCB1cGdyYWRlXG4gIGlmIChpc0FkbWluICYmICh1c2VyLnBsYW4gIT09ICdhZ2VuY3knIHx8IHVzZXIuY3JlZGl0c19iYWxhbmNlIDwgOTk5OTk5KSkge1xuICAgIGNvbnN0IHsgcm93czogdXBncmFkZWQgfSA9IGF3YWl0IHF1ZXJ5PFVzZXJSb3c+KFxuICAgICAgYFVQREFURSB1c2VycyBTRVQgcGxhbj0nYWdlbmN5JywgY3JlZGl0c19iYWxhbmNlPTk5OTk5OSwgaXNfYWRtaW49VFJVRSBXSEVSRSBpZD0kMSBSRVRVUk5JTkcgKmAsXG4gICAgICBbdXNlci5pZF1cbiAgICApO1xuICAgIHJldHVybiB1cGdyYWRlZFswXTtcbiAgfVxuICByZXR1cm4gdXNlcjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVzZXJCeUxvY2FsQXV0aChlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxVc2VyUm93IHwgbnVsbD4ge1xuICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PFVzZXJSb3c+KCdTRUxFQ1QgKiBGUk9NIHVzZXJzIFdIRVJFIGVtYWlsPSQxIExJTUlUIDEnLCBbZW1haWxdKTtcbiAgcmV0dXJuIHJvd3NbMF0gPz8gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVzZXJCeUlkKGlkOiBzdHJpbmcpOiBQcm9taXNlPFVzZXJSb3cgfCBudWxsPiB7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8VXNlclJvdz4oJ1NFTEVDVCAqIEZST00gdXNlcnMgV0hFUkUgaWQ9JDEgTElNSVQgMScsIFtpZF0pO1xuICByZXR1cm4gcm93c1swXSA/PyBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlTG9jYWxVc2VyKFxuICBlbWFpbDogc3RyaW5nLFxuICBwYXNzd29yZEhhc2g6IHN0cmluZyxcbiAgYWRtaW5FbWFpbD86IHN0cmluZyxcbiAgZW1haWxWZXJpZmllZCA9IGZhbHNlXG4pOiBQcm9taXNlPFVzZXJSb3c+IHtcbiAgY29uc3QgaXNBZG1pbiA9IGFkbWluRW1haWwgJiYgZW1haWwudG9Mb3dlckNhc2UoKSA9PT0gYWRtaW5FbWFpbC50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBsb2NhbElkZW50aXR5ID0gYGxvY2FsOiR7ZW1haWwudG9Mb3dlckNhc2UoKX1gO1xuICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PFVzZXJSb3c+KFxuICAgIGBJTlNFUlQgSU5UTyB1c2VycyAoZmlyZWJhc2VfdWlkLCBlbWFpbCwgcGFzc3dvcmRfaGFzaCwgcGxhbiwgY3JlZGl0c19iYWxhbmNlLCBpc19hZG1pbiwgZW1haWxfdmVyaWZpZWQpXG4gICAgIFZBTFVFUyAoJDEsICQyLCAkMywgJDQsICQ1LCAkNiwgJDcpXG4gICAgIE9OIENPTkZMSUNUIChlbWFpbCkgRE8gVVBEQVRFIFNFVCBwYXNzd29yZF9oYXNoPUVYQ0xVREVELnBhc3N3b3JkX2hhc2gsIGlzX2FkbWluPXVzZXJzLmlzX2FkbWluIE9SIEVYQ0xVREVELmlzX2FkbWluXG4gICAgIFJFVFVSTklORyAqYCxcbiAgICBbbG9jYWxJZGVudGl0eSwgZW1haWwsIHBhc3N3b3JkSGFzaCwgaXNBZG1pbiA/ICdhZ2VuY3knIDogJ2ZyZWUnLCBpc0FkbWluID8gOTk5OTk5IDogMCwgQm9vbGVhbihpc0FkbWluKSwgZW1haWxWZXJpZmllZF1cbiAgKTtcbiAgcmV0dXJuIHJvd3NbMF07XG59XG5cbi8vIC0tLS0gRW1haWwgdmVyaWZpY2F0aW9uIChwZW5kaW5nIHNpZ24tdXBzKSAtLS0tXG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVuZGluZ1ZlcmlmaWNhdGlvblJvdyB7XG4gIGlkOiBzdHJpbmc7XG4gIGVtYWlsOiBzdHJpbmc7XG4gIHBhc3N3b3JkX2hhc2g6IHN0cmluZztcbiAgY29kZV9oYXNoOiBzdHJpbmc7XG4gIGF0dGVtcHRzOiBudW1iZXI7XG4gIGV4cGlyZXNfYXQ6IERhdGU7XG4gIGNyZWF0ZWRfYXQ6IERhdGU7XG59XG5cbi8qKiBDcmVhdGVzIChvciByZXBsYWNlcykgdGhlIHBlbmRpbmcgdmVyaWZpY2F0aW9uIHJvdyBmb3IgYW4gZW1haWwsIHJlc2V0dGluZyBhdHRlbXB0cy4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cHNlcnRQZW5kaW5nVmVyaWZpY2F0aW9uKFxuICBlbWFpbDogc3RyaW5nLFxuICBwYXNzd29yZEhhc2g6IHN0cmluZyxcbiAgY29kZUhhc2g6IHN0cmluZyxcbiAgZXhwaXJlc0F0OiBEYXRlXG4pOiBQcm9taXNlPFBlbmRpbmdWZXJpZmljYXRpb25Sb3c+IHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxQZW5kaW5nVmVyaWZpY2F0aW9uUm93PihcbiAgICBgSU5TRVJUIElOVE8gcGVuZGluZ192ZXJpZmljYXRpb25zIChlbWFpbCwgcGFzc3dvcmRfaGFzaCwgY29kZV9oYXNoLCBhdHRlbXB0cywgZXhwaXJlc19hdClcbiAgICAgVkFMVUVTICgkMSwgJDIsICQzLCAwLCAkNClcbiAgICAgT04gQ09ORkxJQ1QgKGVtYWlsKSBETyBVUERBVEVcbiAgICAgICBTRVQgcGFzc3dvcmRfaGFzaCA9IEVYQ0xVREVELnBhc3N3b3JkX2hhc2gsIGNvZGVfaGFzaCA9IEVYQ0xVREVELmNvZGVfaGFzaCxcbiAgICAgICAgICAgYXR0ZW1wdHMgPSAwLCBleHBpcmVzX2F0ID0gRVhDTFVERUQuZXhwaXJlc19hdCwgY3JlYXRlZF9hdCA9IE5PVygpXG4gICAgIFJFVFVSTklORyAqYCxcbiAgICBbZW1haWwsIHBhc3N3b3JkSGFzaCwgY29kZUhhc2gsIGV4cGlyZXNBdF1cbiAgKTtcbiAgcmV0dXJuIHJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRQZW5kaW5nVmVyaWZpY2F0aW9uKGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPFBlbmRpbmdWZXJpZmljYXRpb25Sb3cgfCBudWxsPiB7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8UGVuZGluZ1ZlcmlmaWNhdGlvblJvdz4oJ1NFTEVDVCAqIEZST00gcGVuZGluZ192ZXJpZmljYXRpb25zIFdIRVJFIGVtYWlsPSQxIExJTUlUIDEnLCBbZW1haWxdKTtcbiAgcmV0dXJuIHJvd3NbMF0gPz8gbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bXBWZXJpZmljYXRpb25BdHRlbXB0cyhlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTx7IGF0dGVtcHRzOiBudW1iZXIgfT4oXG4gICAgJ1VQREFURSBwZW5kaW5nX3ZlcmlmaWNhdGlvbnMgU0VUIGF0dGVtcHRzID0gYXR0ZW1wdHMgKyAxIFdIRVJFIGVtYWlsPSQxIFJFVFVSTklORyBhdHRlbXB0cycsXG4gICAgW2VtYWlsXVxuICApO1xuICByZXR1cm4gcm93c1swXT8uYXR0ZW1wdHMgPz8gMDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZVBlbmRpbmdWZXJpZmljYXRpb24oZW1haWw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBxdWVyeSgnREVMRVRFIEZST00gcGVuZGluZ192ZXJpZmljYXRpb25zIFdIRVJFIGVtYWlsPSQxJywgW2VtYWlsXSk7XG59XG5cbi8qKiBBdHRhY2hlcyBhbiBhbm9ueW1vdXMgKGd1ZXN0KSBqb2IgdG8gYSBuZXdseSBhdXRoZW50aWNhdGVkIGFjY291bnQsIG9uY2UsIGlmIGl0IGlzbid0IG93bmVkIHlldC4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGFpbUpvYihqb2JJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PHsgaWQ6IHN0cmluZyB9PihcbiAgICAnVVBEQVRFIGpvYnMgU0VUIHVzZXJfaWQ9JDEsIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDIgQU5EIHVzZXJfaWQgSVMgTlVMTCBBTkQgZGVsZXRlZF9hdCBJUyBOVUxMIFJFVFVSTklORyBpZCcsXG4gICAgW3VzZXJJZCwgam9iSWRdXG4gICk7XG4gIHJldHVybiByb3dzLmxlbmd0aCA+IDA7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzcGVuZENyZWRpdHModXNlcklkOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8eyBjcmVkaXRzX2JhbGFuY2U6IG51bWJlciB9PihcbiAgICBgVVBEQVRFIHVzZXJzIFNFVCBjcmVkaXRzX2JhbGFuY2UgPSBjcmVkaXRzX2JhbGFuY2UgLSAkMVxuICAgICBXSEVSRSBpZCA9ICQyIEFORCBjcmVkaXRzX2JhbGFuY2UgPj0gJDFcbiAgICAgUkVUVVJOSU5HIGNyZWRpdHNfYmFsYW5jZWAsXG4gICAgW2Ftb3VudCwgdXNlcklkXVxuICApO1xuICByZXR1cm4gcm93c1swXT8uY3JlZGl0c19iYWxhbmNlID8/IG51bGw7XG59XG5cbmV4cG9ydCB0eXBlIFJlbmRlckNsYWltUmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyByZW1haW5pbmc6IG51bWJlciB9XG4gIHwgeyBvazogZmFsc2U7IHJlYXNvbjogJ25vdF9mb3VuZCcgfCAnbm90X293bmVyJyB8ICdhbHJlYWR5X3N0YXJ0ZWQnIHwgJ2FscmVhZHlfZmFpbGVkJyB8ICdpbnN1ZmZpY2llbnRfY3JlZGl0cycgfTtcblxuLyoqXG4gKiBBdG9taWNhbGx5IGNsYWltcyBhIGpvYiBhbmQgY2hhcmdlcyBpdCBvbmNlLCBwcmV2ZW50aW5nIGRvdWJsZS1jbGljayBiaWxsaW5nLlxuICpcbiAqIEEgam9iIHdob3NlICpwcmV2aW91cyogcmVuZGVyIGF0dGVtcHQgYWxyZWFkeSBmYWlsZWQgaXMgZGVsaWJlcmF0ZWx5XG4gKiBibG9ja2VkIGhlcmUgdG9vIChub3QganVzdCAncmVuZGVyaW5nJy8nZG9uZScpLiBXaXRob3V0IHRoaXMsIGEgY2xpZW50XG4gKiByZXRyeWluZyB0aGUgc2FtZSBqb2IgaWQgYWZ0ZXIgYSBmYWlsZWQgcmVuZGVyIHdvdWxkIHJlLWV4ZWN1dGUgdGhlIGV4YWN0XG4gKiBzYW1lIGFscmVhZHktZ2VuZXJhdGVkIHN0b3J5Ym9hcmQgKHNhbWUgc2NlbmVzLCBzYW1lIGNyb3BzLCBzYW1lIHZhcmlhbnRcbiAqIHNlZWQpIGFuZCBjb3VsZCBhcHBlYXIgdG8gXCJyZWdlbmVyYXRlIHRoZSBzYW1lIHZpZGVvLlwiIFN0b3J5Ym9hcmQtcGxhbm5pbmdcbiAqIGZhaWx1cmVzIG5ldmVyIHJlYWNoIHRoaXMgZnVuY3Rpb24gaW4gdGhlIGZpcnN0IHBsYWNlIChubyBzdG9yeWJvYXJkIHdhc1xuICogZXZlciBzYXZlZCwgc28gdGhlIHJlbmRlciByb3V0ZSBhbHJlYWR5IHJlamVjdHMgd2l0aCBTVE9SWUJPQVJEX05PVF9SRUFEWVxuICogYmVmb3JlIGNhbGxpbmcgdGhpcyksIHNvIHRoaXMgb25seSBjbG9zZXMgdGhlIHJlbmRlci1yZXRyeSBsb29waG9sZS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsYWltUmVuZGVyQW5kU3BlbmQoam9iSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyKTogUHJvbWlzZTxSZW5kZXJDbGFpbVJlc3VsdD4ge1xuICBjb25zdCBjbGllbnQgPSBhd2FpdCBwb29sLmNvbm5lY3QoKTtcbiAgdHJ5IHtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0JFR0lOJyk7XG4gICAgY29uc3QgeyByb3dzOiBqb2JzIH0gPSBhd2FpdCBjbGllbnQucXVlcnk8eyB1c2VyX2lkOiBzdHJpbmcgfCBudWxsOyBzdGF0dXM6IHN0cmluZyB9PihcbiAgICAgICdTRUxFQ1QgdXNlcl9pZCwgc3RhdHVzIEZST00gam9icyBXSEVSRSBpZD0kMSBGT1IgVVBEQVRFJywgW2pvYklkXVxuICAgICk7XG4gICAgY29uc3Qgam9iID0gam9ic1swXTtcbiAgICBpZiAoIWpvYikge1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpO1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb246ICdub3RfZm91bmQnIH07XG4gICAgfVxuICAgIGlmIChqb2IudXNlcl9pZCAmJiBqb2IudXNlcl9pZCAhPT0gdXNlcklkKSB7XG4gICAgICBhd2FpdCBjbGllbnQucXVlcnkoJ1JPTExCQUNLJyk7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogJ25vdF9vd25lcicgfTtcbiAgICB9XG4gICAgaWYgKGpvYi5zdGF0dXMgPT09ICdyZW5kZXJpbmcnIHx8IGpvYi5zdGF0dXMgPT09ICdkb25lJykge1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpO1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb246ICdhbHJlYWR5X3N0YXJ0ZWQnIH07XG4gICAgfVxuICAgIGlmIChqb2Iuc3RhdHVzID09PSAnZmFpbGVkJyB8fCBqb2Iuc3RhdHVzID09PSAnY2FuY2VsbGVkJykge1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpO1xuICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb246ICdhbHJlYWR5X2ZhaWxlZCcgfTtcbiAgICB9XG4gICAgY29uc3QgeyByb3dzOiB1c2VycyB9ID0gYXdhaXQgY2xpZW50LnF1ZXJ5PHsgY3JlZGl0c19iYWxhbmNlOiBudW1iZXIgfT4oXG4gICAgICBgVVBEQVRFIHVzZXJzIFNFVCBjcmVkaXRzX2JhbGFuY2U9Y3JlZGl0c19iYWxhbmNlLSQxLCB1cGRhdGVkX2F0PU5PVygpXG4gICAgICAgV0hFUkUgaWQ9JDIgQU5EIGNyZWRpdHNfYmFsYW5jZSA+PSAkMSBSRVRVUk5JTkcgY3JlZGl0c19iYWxhbmNlYCxcbiAgICAgIFthbW91bnQsIHVzZXJJZF1cbiAgICApO1xuICAgIGlmICghdXNlcnNbMF0pIHtcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnUk9MTEJBQ0snKTtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiAnaW5zdWZmaWNpZW50X2NyZWRpdHMnIH07XG4gICAgfVxuICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgIGBVUERBVEUgam9icyBTRVQgdXNlcl9pZD0kMSwgc3RhdHVzPSdyZW5kZXJpbmcnLCBwcm9ncmVzcz04MCwgY3JlZGl0c19zcGVudD0kMywgZXJyb3JfbWVzc2FnZT1OVUxMLCB1cGRhdGVkX2F0PU5PVygpXG4gICAgICAgV0hFUkUgaWQ9JDJgLFxuICAgICAgW3VzZXJJZCwgam9iSWQsIGFtb3VudF1cbiAgICApO1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgICdJTlNFUlQgSU5UTyBjcmVkaXRfdHJhbnNhY3Rpb25zICh1c2VyX2lkLCBkZWx0YSwgcmVhc29uKSBWQUxVRVMgKCQxLCQyLCQzKScsXG4gICAgICBbdXNlcklkLCAtYW1vdW50LCBgUmVuZGVyICR7am9iSWR9YF1cbiAgICApO1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnQ09NTUlUJyk7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIHJlbWFpbmluZzogdXNlcnNbMF0uY3JlZGl0c19iYWxhbmNlIH07XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnUk9MTEJBQ0snKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgdGhyb3cgZXJyO1xuICB9IGZpbmFsbHkge1xuICAgIGNsaWVudC5yZWxlYXNlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZnVuZENyZWRpdHModXNlcklkOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyLCByZWFzb246IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoYW1vdW50IDw9IDApIHJldHVybjtcbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgcG9vbC5jb25uZWN0KCk7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdCRUdJTicpO1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgICdVUERBVEUgdXNlcnMgU0VUIGNyZWRpdHNfYmFsYW5jZT1jcmVkaXRzX2JhbGFuY2UrJDEsIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDInLFxuICAgICAgW2Ftb3VudCwgdXNlcklkXVxuICAgICk7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KFxuICAgICAgJ0lOU0VSVCBJTlRPIGNyZWRpdF90cmFuc2FjdGlvbnMgKHVzZXJfaWQsIGRlbHRhLCByZWFzb24pIFZBTFVFUyAoJDEsJDIsJDMpJyxcbiAgICAgIFt1c2VySWQsIGFtb3VudCwgcmVhc29uXVxuICAgICk7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdDT01NSVQnKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpLmNhdGNoKCgpID0+IHt9KTtcbiAgICB0aHJvdyBlcnI7XG4gIH0gZmluYWxseSB7XG4gICAgY2xpZW50LnJlbGVhc2UoKTtcbiAgfVxufVxuXG4vKiogUmVmdW5kcyBvbmx5IGNyZWRpdHMgc3RpbGwgcmVzZXJ2ZWQgYnkgdGhpcyBqb2IsIGF0b21pY2FsbHkgd2l0aCBqb2Igc3RhdGUuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVmdW5kSm9iQ3JlZGl0cyhcbiAgam9iSWQ6IHN0cmluZyxcbiAgdXNlcklkOiBzdHJpbmcsXG4gIHJlcXVlc3RlZEFtb3VudDogbnVtYmVyLFxuICByZWFzb246IHN0cmluZyxcbik6IFByb21pc2U8bnVtYmVyPiB7XG4gIGlmIChyZXF1ZXN0ZWRBbW91bnQgPD0gMCkgcmV0dXJuIDA7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICB0cnkge1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnQkVHSU4nKTtcbiAgICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IGNsaWVudC5xdWVyeTx7IHVzZXJfaWQ6IHN0cmluZyB8IG51bGw7IGNyZWRpdHNfc3BlbnQ6IG51bWJlciB9PihcbiAgICAgICdTRUxFQ1QgdXNlcl9pZCwgY3JlZGl0c19zcGVudCBGUk9NIGpvYnMgV0hFUkUgaWQ9JDEgRk9SIFVQREFURScsXG4gICAgICBbam9iSWRdLFxuICAgICk7XG4gICAgY29uc3Qgam9iID0gcm93c1swXTtcbiAgICBpZiAoIWpvYiB8fCBqb2IudXNlcl9pZCAhPT0gdXNlcklkIHx8IGpvYi5jcmVkaXRzX3NwZW50IDw9IDApIHtcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnUk9MTEJBQ0snKTtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBjb25zdCBhbW91bnQgPSBNYXRoLm1pbihyZXF1ZXN0ZWRBbW91bnQsIGpvYi5jcmVkaXRzX3NwZW50KTtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoXG4gICAgICAnVVBEQVRFIHVzZXJzIFNFVCBjcmVkaXRzX2JhbGFuY2U9Y3JlZGl0c19iYWxhbmNlKyQxLCB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQyJyxcbiAgICAgIFthbW91bnQsIHVzZXJJZF0sXG4gICAgKTtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoXG4gICAgICAnSU5TRVJUIElOVE8gY3JlZGl0X3RyYW5zYWN0aW9ucyAodXNlcl9pZCwgZGVsdGEsIHJlYXNvbikgVkFMVUVTICgkMSwkMiwkMyknLFxuICAgICAgW3VzZXJJZCwgYW1vdW50LCByZWFzb25dLFxuICAgICk7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KFxuICAgICAgJ1VQREFURSBqb2JzIFNFVCBjcmVkaXRzX3NwZW50PWNyZWRpdHNfc3BlbnQtJDEsIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDInLFxuICAgICAgW2Ftb3VudCwgam9iSWRdLFxuICAgICk7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdDT01NSVQnKTtcbiAgICByZXR1cm4gYW1vdW50O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoJ1JPTExCQUNLJykuY2F0Y2goKCkgPT4ge30pO1xuICAgIHRocm93IGVycjtcbiAgfSBmaW5hbGx5IHtcbiAgICBjbGllbnQucmVsZWFzZSgpO1xuICB9XG59XG5cbi8vIC0tLS0gSm9icyAtLS0tXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVKb2IoXG4gIHVzZXJJZDogc3RyaW5nIHwgbnVsbCxcbiAgc291cmNlVXJsOiBzdHJpbmcsXG4gIG1vZGU6IHN0cmluZyA9ICd2aWRlbydcbik6IFByb21pc2U8Sm9iUm93PiB7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8Sm9iUm93PihcbiAgICBgSU5TRVJUIElOVE8gam9icyAodXNlcl9pZCwgc291cmNlX3VybCwgc3RhdHVzLCBwcm9ncmVzcywgbW9kZSwgc3RhdHVzX21lc3NhZ2UsIGV0YV9zZWNvbmRzKVxuICAgICBWQUxVRVMgKCQxLCAkMiwgJ2NhcHR1cmluZycsIDUsICQzLCAnUHJlcGFyaW5nIHNlY3VyZSB3ZWJzaXRlIGNhcHR1cmUnLCAyNDApIFJFVFVSTklORyAqYCxcbiAgICBbdXNlcklkLCBzb3VyY2VVcmwsIG1vZGVdXG4gICk7XG4gIHJldHVybiByb3dzWzBdO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlSm9iRnJvbUNhcHR1cmUodXNlcklkOiBzdHJpbmcsIHNvdXJjZTogSm9iUm93KTogUHJvbWlzZTxKb2JSb3c+IHtcbiAgY29uc3QgbWV0YWRhdGEgPSBzb3VyY2UuY2FwdHVyZV9tZXRhZGF0YVxuICAgID8gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShzb3VyY2UuY2FwdHVyZV9tZXRhZGF0YSkucmVwbGFjZUFsbChzb3VyY2UuaWQsICdfX05FV19KT0JfSURfXycpKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICAgIDogbnVsbDtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxKb2JSb3c+KFxuICAgIGBJTlNFUlQgSU5UTyBqb2JzXG4gICAgICAodXNlcl9pZCwgc291cmNlX3VybCwgc3RhdHVzLCBwcm9ncmVzcywgbW9kZSwgc3RhdHVzX21lc3NhZ2UsIGV0YV9zZWNvbmRzLCBjYXB0dXJlX21ldGFkYXRhLCB0aXRsZSwgcGFyZW50X2pvYl9pZClcbiAgICAgVkFMVUVTICgkMSwkMiwnY2FwdHVyZWQnLDQwLCd2aWRlbycsJ1NhdmVkIHdlYnNpdGUgY2FwdHVyZSByZWFkeScsMCwkMywkNCwkNSlcbiAgICAgUkVUVVJOSU5HICpgLFxuICAgIFt1c2VySWQsIHNvdXJjZS5zb3VyY2VfdXJsLCBtZXRhZGF0YSwgc291cmNlLnRpdGxlLCBzb3VyY2UuaWRdXG4gICk7XG4gIGNvbnN0IGpvYiA9IHJvd3NbMF07XG4gIGxldCByZXN1bHQgPSBqb2I7XG4gIGlmIChtZXRhZGF0YSkge1xuICAgIGNvbnN0IGNvcnJlY3RlZCA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpLnJlcGxhY2VBbGwoJ19fTkVXX0pPQl9JRF9fJywgam9iLmlkKSkgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgcmVzdWx0ID0gKGF3YWl0IHVwZGF0ZUpvYihqb2IuaWQsIHsgY2FwdHVyZV9tZXRhZGF0YTogY29ycmVjdGVkIH0pKSA/PyBqb2I7XG4gIH1cbiAgLy8gQSByZXVzZWQgY2FwdHVyZSBpcyBhIG5ldyBjcmVhdGl2ZSBjb252ZXJzYXRpb24vdmVyc2lvbi4gRG8gbm90IGNsb25lIHRoZVxuICAvLyBwcmV2aW91cyB0cmFuc2NyaXB0LCBzdG9yeWJvYXJkL3JlbmRlciBtZXNzYWdlcywgb3IgcmVzdWx0IGNoYXR0ZXIgaW50byBpdC5cbiAgLy8gVGhlIHJldXNlIHJvdXRlIGFkZHMgb25lIGNvbmNpc2UgcHJvdmVuYW5jZSBtZXNzYWdlIGluc3RlYWQuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgam9iIGRpcmVjdGx5IGZyb20gdXNlci11cGxvYWRlZCBwaG90b3MsIGJ5cGFzc2luZyB0aGUgd2Vic2l0ZVxuICogY2FwdHVyZSAoUGxheXdyaWdodCkgc3RlcCBlbnRpcmVseS4gTGFuZHMgaW4gJ2NhcHR1cmVkJyBzdGF0dXMgd2l0aFxuICogY2FwdHVyZV9tZXRhZGF0YSBhbHJlYWR5IHBvcHVsYXRlZCBpbiB0aGUgZXhhY3Qgc2FtZSBzaGFwZSB0aGUgd2Vic2l0ZVxuICogY2FwdHVyZSBmbG93IHByb2R1Y2VzIChhIHRpdGxlICsgYSBgcGFnZXNgIGFycmF5IG9mIHt1cmwsIHRpdGxlLFxuICogc2NyZWVuc2hvdFVybH0pLCBzbyBldmVyeSBkb3duc3RyZWFtIGNvbnN1bWVyIFx1MjAxNCB0aGUgc3Rvcnlib2FyZCBwbGFubmVyLFxuICogbG9hZFJlZmVyZW5jZUNhcHR1cmVzKCkgaW4gam9icy50cywgdGhlIGZyb250ZW5kJ3MgZXhpc3RpbmcgXCJjYXB0dXJpbmcgLT5cbiAqIGF3YWl0aW5nX21vZGVcIiBwb2xsaW5nIHRyYW5zaXRpb24gXHUyMDE0IG5lZWRzIHplcm8gc3BlY2lhbC1jYXNpbmcgZm9yIHVwbG9hZHMuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVVcGxvYWRKb2IoXG4gIHVzZXJJZDogc3RyaW5nIHwgbnVsbCxcbiAgdGl0bGU6IHN0cmluZyxcbiAgY2FwdHVyZU1ldGFkYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbik6IFByb21pc2U8Sm9iUm93PiB7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8Sm9iUm93PihcbiAgICBgSU5TRVJUIElOVE8gam9ic1xuICAgICAgKHVzZXJfaWQsIHNvdXJjZV91cmwsIHN0YXR1cywgcHJvZ3Jlc3MsIG1vZGUsIHN0YXR1c19tZXNzYWdlLCBldGFfc2Vjb25kcywgY2FwdHVyZV9tZXRhZGF0YSwgdGl0bGUpXG4gICAgIFZBTFVFUyAoJDEsJDIsJ2NhcHR1cmVkJyw0MCwndmlkZW8nLCdZb3VyIHVwbG9hZGVkIHBob3RvcyBhcmUgcmVhZHknLDAsJDMsJDQpXG4gICAgIFJFVFVSTklORyAqYCxcbiAgICBbdXNlcklkLCBgdXBsb2FkOi8vJHt0aXRsZS50cmltKCkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV0rL2csICctJykucmVwbGFjZSgvKF4tfC0kKS9nLCAnJykgfHwgJ3Bob3Rvcyd9YCwgY2FwdHVyZU1ldGFkYXRhLCB0aXRsZV1cbiAgKTtcbiAgcmV0dXJuIHJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVKb2IoXG4gIGlkOiBzdHJpbmcsXG4gIHBhdGNoOiBQYXJ0aWFsPFBpY2s8Sm9iUm93LCAnc3RhdHVzJyB8ICdwcm9ncmVzcycgfCAnbW9kZScgfCAndmliZV9icmllZicgfCAnY2FwdHVyZV9tZXRhZGF0YScgfCAnc3Rvcnlib2FyZCcgfCAnd29ya2Zsb3dfc3RhdGUnIHwgJ3N0YXR1c19tZXNzYWdlJyB8ICdldGFfc2Vjb25kcycgfCAnY3JlZGl0c19zcGVudCcgfCAnZXJyb3JfbWVzc2FnZScgfCAndGl0bGUnIHwgJ3Bpbm5lZCcgfCAnZGVsZXRlZF9hdCcgfCAnY2FuY2VsX3JlcXVlc3RlZCc+PlxuKTogUHJvbWlzZTxKb2JSb3cgfCBudWxsPiB7XG4gIGNvbnN0IHNldHM6IHN0cmluZ1tdID0gWyd1cGRhdGVkX2F0ID0gTk9XKCknXTtcbiAgY29uc3QgdmFsdWVzOiB1bmtub3duW10gPSBbXTtcbiAgbGV0IGkgPSAxO1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgT2JqZWN0LmVudHJpZXMocGF0Y2gpKSB7XG4gICAgc2V0cy5wdXNoKGAke2tleX0gPSAkJHtpKyt9YCk7XG4gICAgdmFsdWVzLnB1c2godHlwZW9mIHZhbCA9PT0gJ29iamVjdCcgJiYgdmFsICE9PSBudWxsID8gSlNPTi5zdHJpbmdpZnkodmFsKSA6IHZhbCk7XG4gIH1cbiAgdmFsdWVzLnB1c2goaWQpO1xuICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PEpvYlJvdz4oXG4gICAgYFVQREFURSBqb2JzIFNFVCAke3NldHMuam9pbignLCAnKX0gV0hFUkUgaWQgPSAkJHtpfSBSRVRVUk5JTkcgKmAsXG4gICAgdmFsdWVzXG4gICk7XG4gIHJldHVybiByb3dzWzBdID8/IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRKb2IoaWQ6IHN0cmluZyk6IFByb21pc2U8Sm9iUm93IHwgbnVsbD4ge1xuICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IHF1ZXJ5PEpvYlJvdz4oJ1NFTEVDVCAqIEZST00gam9icyBXSEVSRSBpZD0kMSBMSU1JVCAxJywgW2lkXSk7XG4gIHJldHVybiByb3dzWzBdID8/IG51bGw7XG59XG5cbmNvbnN0IENBTkNFTExBQkxFX1NUQVRVU0VTID0gbmV3IFNldChbJ3F1ZXVlZCcsICdjYXB0dXJpbmcnLCAnc3Rvcnlib2FyZGluZycsICdyZW5kZXJpbmcnXSk7XG5cbmV4cG9ydCB0eXBlIENhbmNlbFJlc3VsdCA9XG4gIHwgeyBvazogdHJ1ZTsgaW1tZWRpYXRlOiBib29sZWFuIH0gLy8gaW1tZWRpYXRlPXRydWUgbWVhbnMgaXQgd2FzICdxdWV1ZWQnIHdpdGggbm90aGluZyBydW5uaW5nL2NoYXJnZWQgeWV0XG4gIHwgeyBvazogZmFsc2U7IHJlYXNvbjogJ25vdF9mb3VuZCcgfCAnbm90X293bmVyJyB8ICdub3RfY2FuY2VsbGFibGUnIH07XG5cbi8qKlxuICogRmxhZ3MgYSBqb2IgZm9yIGNvb3BlcmF0aXZlIGNhbmNlbGxhdGlvbi4gVGhlIGluLWZsaWdodCBjYXB0dXJlL3N0b3J5Ym9hcmQvXG4gKiByZW5kZXIgbG9vcCBpcyByZXNwb25zaWJsZSBmb3IgY2hlY2tpbmcgdGhpcyBmbGFnIGJldHdlZW4gc3RlcHMsIHJlZnVuZGluZ1xuICogYW55IGNyZWRpdHMgaXQgYWxyZWFkeSBzcGVudCwgYW5kIHNldHRsaW5nIHRoZSBqb2IgYXMgJ2NhbmNlbGxlZCcgXHUyMDE0IHRoaXNcbiAqIGZ1bmN0aW9uIG9ubHkgcmVjb3JkcyB0aGUgcmVxdWVzdCBhbmQgaGFuZGxlcyB0aGUgdHJpdmlhbCBjYXNlIChub3RoaW5nXG4gKiBoYXMgc3RhcnRlZCB5ZXQpIHN5bmNocm9ub3VzbHkuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXF1ZXN0Sm9iQ2FuY2VsbGF0aW9uKGpvYklkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxDYW5jZWxSZXN1bHQ+IHtcbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgcG9vbC5jb25uZWN0KCk7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdCRUdJTicpO1xuICAgIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgY2xpZW50LnF1ZXJ5PFBpY2s8Sm9iUm93LCAndXNlcl9pZCcgfCAnc3RhdHVzJyB8ICdjcmVkaXRzX3NwZW50Jz4+KFxuICAgICAgJ1NFTEVDVCB1c2VyX2lkLCBzdGF0dXMsIGNyZWRpdHNfc3BlbnQgRlJPTSBqb2JzIFdIRVJFIGlkPSQxIEZPUiBVUERBVEUnLCBbam9iSWRdXG4gICAgKTtcbiAgICBjb25zdCBqb2IgPSByb3dzWzBdO1xuICAgIGlmICgham9iKSB7IGF3YWl0IGNsaWVudC5xdWVyeSgnUk9MTEJBQ0snKTsgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb246ICdub3RfZm91bmQnIH07IH1cbiAgICBpZiAoam9iLnVzZXJfaWQgJiYgam9iLnVzZXJfaWQgIT09IHVzZXJJZCkgeyBhd2FpdCBjbGllbnQucXVlcnkoJ1JPTExCQUNLJyk7IHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiAnbm90X293bmVyJyB9OyB9XG4gICAgaWYgKCFDQU5DRUxMQUJMRV9TVEFUVVNFUy5oYXMoam9iLnN0YXR1cykpIHsgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpOyByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbjogJ25vdF9jYW5jZWxsYWJsZScgfTsgfVxuXG4gICAgaWYgKGpvYi5zdGF0dXMgPT09ICdxdWV1ZWQnKSB7XG4gICAgICAvLyBOb3RoaW5nIGlzIHJ1bm5pbmcgYW5kIG5vdGhpbmcgaGFzIGJlZW4gY2hhcmdlZCB5ZXQgXHUyMDE0IHNldHRsZSBpbW1lZGlhdGVseS5cbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgICAgYFVQREFURSBqb2JzIFNFVCBzdGF0dXM9J2NhbmNlbGxlZCcsIGNhbmNlbF9yZXF1ZXN0ZWQ9VFJVRSwgc3RhdHVzX21lc3NhZ2U9J0NhbmNlbGxlZCcsIGV0YV9zZWNvbmRzPTAsIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDFgLFxuICAgICAgICBbam9iSWRdXG4gICAgICApO1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdDT01NSVQnKTtcbiAgICAgIHJldHVybiB7IG9rOiB0cnVlLCBpbW1lZGlhdGU6IHRydWUgfTtcbiAgICB9XG5cbiAgICBhd2FpdCBjbGllbnQucXVlcnkoYFVQREFURSBqb2JzIFNFVCBjYW5jZWxfcmVxdWVzdGVkPVRSVUUsIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDFgLCBbam9iSWRdKTtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0NPTU1JVCcpO1xuICAgIHJldHVybiB7IG9rOiB0cnVlLCBpbW1lZGlhdGU6IGZhbHNlIH07XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnUk9MTEJBQ0snKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgdGhyb3cgZXJyO1xuICB9IGZpbmFsbHkge1xuICAgIGNsaWVudC5yZWxlYXNlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlzQ2FuY2VsUmVxdWVzdGVkKGpvYklkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTx7IGNhbmNlbF9yZXF1ZXN0ZWQ6IGJvb2xlYW4gfT4oJ1NFTEVDVCBjYW5jZWxfcmVxdWVzdGVkIEZST00gam9icyBXSEVSRSBpZD0kMScsIFtqb2JJZF0pO1xuICByZXR1cm4gcm93c1swXT8uY2FuY2VsX3JlcXVlc3RlZCA/PyBmYWxzZTtcbn1cblxuLyoqIEEgcHJvY2VzcyByZXN0YXJ0IGludGVycnVwdHMgaW4tbWVtb3J5IHdvcms7IG5ldmVyIGxlYXZlIHRob3NlIGpvYnMgc3Bpbm5pbmcgZm9yZXZlci4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWNvdmVySW50ZXJydXB0ZWRKb2JzKCk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICB0cnkge1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnQkVHSU4nKTtcbiAgICBjb25zdCB7IHJvd3MgfSA9IGF3YWl0IGNsaWVudC5xdWVyeTxQaWNrPEpvYlJvdywgJ2lkJyB8ICd1c2VyX2lkJyB8ICdzdGF0dXMnIHwgJ2NyZWRpdHNfc3BlbnQnPj4oXG4gICAgICBgU0VMRUNUIGlkLCB1c2VyX2lkLCBzdGF0dXMsIGNyZWRpdHNfc3BlbnQgRlJPTSBqb2JzXG4gICAgICAgV0hFUkUgc3RhdHVzIElOICgncXVldWVkJywnY2FwdHVyaW5nJywnc3Rvcnlib2FyZGluZycsJ3JlbmRlcmluZycpIEZPUiBVUERBVEVgXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IGpvYiBvZiByb3dzKSB7XG4gICAgICBpZiAoam9iLnN0YXR1cyA9PT0gJ3JlbmRlcmluZycgJiYgam9iLnVzZXJfaWQgJiYgam9iLmNyZWRpdHNfc3BlbnQgPiAwKSB7XG4gICAgICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgICAgICAnVVBEQVRFIHVzZXJzIFNFVCBjcmVkaXRzX2JhbGFuY2U9Y3JlZGl0c19iYWxhbmNlKyQxLCB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQyJyxcbiAgICAgICAgICBbam9iLmNyZWRpdHNfc3BlbnQsIGpvYi51c2VyX2lkXVxuICAgICAgICApO1xuICAgICAgICBhd2FpdCBjbGllbnQucXVlcnkoXG4gICAgICAgICAgJ0lOU0VSVCBJTlRPIGNyZWRpdF90cmFuc2FjdGlvbnMgKHVzZXJfaWQsIGRlbHRhLCByZWFzb24pIFZBTFVFUyAoJDEsJDIsJDMpJyxcbiAgICAgICAgICBbam9iLnVzZXJfaWQsIGpvYi5jcmVkaXRzX3NwZW50LCBgSW50ZXJydXB0ZWQgcmVuZGVyIHJlZnVuZCAke2pvYi5pZH1gXVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocm93cy5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgICAgYFVQREFURSBqb2JzXG4gICAgICAgICBTRVQgc3RhdHVzPSdmYWlsZWQnLCBwcm9ncmVzcz0wLCBldGFfc2Vjb25kcz0wLCBjcmVkaXRzX3NwZW50PTAsXG4gICAgICAgICAgICAgc3RhdHVzX21lc3NhZ2U9J1RoZSBwcmV2aW91cyBhdHRlbXB0IHdhcyBpbnRlcnJ1cHRlZCcsXG4gICAgICAgICAgICAgZXJyb3JfbWVzc2FnZT0nVGhhdCBhdHRlbXB0IHdhcyBpbnRlcnJ1cHRlZCBiZWZvcmUgaXQgZmluaXNoZWQuIEFueSByZXNlcnZlZCBjcmVkaXRzIHdlcmUgcmVzdG9yZWQ7IHBsZWFzZSBzdGFydCBpdCBhZ2Fpbi4nLFxuICAgICAgICAgICAgIHVwZGF0ZWRfYXQ9Tk9XKClcbiAgICAgICAgIFdIRVJFIGlkID0gQU5ZKCQxOjp1dWlkW10pYCxcbiAgICAgICAgW3Jvd3MubWFwKChqb2IpID0+IGpvYi5pZCldXG4gICAgICApO1xuICAgIH1cbiAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0NPTU1JVCcpO1xuICAgIHJldHVybiByb3dzLmxlbmd0aDtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpLmNhdGNoKCgpID0+IHt9KTtcbiAgICB0aHJvdyBlcnI7XG4gIH0gZmluYWxseSB7XG4gICAgY2xpZW50LnJlbGVhc2UoKTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Sm9ic0J5VXNlcih1c2VySWQ6IHN0cmluZywgbGltaXQgPSAyMCk6IFByb21pc2U8Sm9iUm93W10+IHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxKb2JSb3c+KFxuICAgIGBTRUxFQ1QgKiBGUk9NIGpvYnNcbiAgICAgV0hFUkUgdXNlcl9pZD0kMSBBTkQgZGVsZXRlZF9hdCBJUyBOVUxMXG4gICAgIE9SREVSIEJZIHBpbm5lZCBERVNDLCB1cGRhdGVkX2F0IERFU0MgTElNSVQgJDJgLFxuICAgIFt1c2VySWQsIGxpbWl0XVxuICApO1xuICByZXR1cm4gcm93cztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZEpvYk1lc3NhZ2UoXG4gIGpvYklkOiBzdHJpbmcsXG4gIHJvbGU6IEpvYk1lc3NhZ2VSb3dbJ3JvbGUnXSxcbiAgY29udGVudDogc3RyaW5nLFxuICBraW5kID0gJ3RleHQnLFxuICBwYXlsb2FkPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsLFxuKTogUHJvbWlzZTxKb2JNZXNzYWdlUm93PiB7XG4gIGNvbnN0IHsgcm93cyB9ID0gYXdhaXQgcXVlcnk8Sm9iTWVzc2FnZVJvdz4oXG4gICAgYElOU0VSVCBJTlRPIGpvYl9tZXNzYWdlcyAoam9iX2lkLCByb2xlLCBraW5kLCBjb250ZW50LCBwYXlsb2FkKVxuICAgICBWQUxVRVMgKCQxLCQyLCQzLCQ0LCQ1KSBSRVRVUk5JTkcgKmAsXG4gICAgW2pvYklkLCByb2xlLCBraW5kLCBjb250ZW50LCBwYXlsb2FkID8gSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkgOiBudWxsXVxuICApO1xuICBhd2FpdCBxdWVyeSgnVVBEQVRFIGpvYnMgU0VUIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDEnLCBbam9iSWRdKTtcbiAgcmV0dXJuIHJvd3NbMF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRKb2JNZXNzYWdlcyhqb2JJZDogc3RyaW5nKTogUHJvbWlzZTxKb2JNZXNzYWdlUm93W10+IHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxKb2JNZXNzYWdlUm93PihcbiAgICAnU0VMRUNUICogRlJPTSBqb2JfbWVzc2FnZXMgV0hFUkUgam9iX2lkPSQxIE9SREVSIEJZIGNyZWF0ZWRfYXQgQVNDJyxcbiAgICBbam9iSWRdXG4gICk7XG4gIHJldHVybiByb3dzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc29mdERlbGV0ZUpvYihqb2JJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB7IHJvd0NvdW50IH0gPSBhd2FpdCBxdWVyeShcbiAgICAnVVBEQVRFIGpvYnMgU0VUIGRlbGV0ZWRfYXQ9Tk9XKCksIHBpbm5lZD1GQUxTRSwgdXBkYXRlZF9hdD1OT1coKSBXSEVSRSBpZD0kMSBBTkQgdXNlcl9pZD0kMiBBTkQgZGVsZXRlZF9hdCBJUyBOVUxMJyxcbiAgICBbam9iSWQsIHVzZXJJZF1cbiAgKTtcbiAgcmV0dXJuIChyb3dDb3VudCA/PyAwKSA+IDA7XG59XG5cbi8vIC0tLS0gQXNzZXRzIC0tLS1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUFzc2V0KFxuICBqb2JJZDogc3RyaW5nLFxuICB0eXBlOiBzdHJpbmcsXG4gIHN0b3JhZ2VVcmw6IHN0cmluZyxcbiAgYXNwZWN0UmF0aW86IHN0cmluZyB8IG51bGwsXG4gIHdhdGVybWFya2VkOiBib29sZWFuLFxuICBkb3dubG9hZGFibGU6IGJvb2xlYW5cbik6IFByb21pc2U8QXNzZXRSb3c+IHtcbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxBc3NldFJvdz4oXG4gICAgYElOU0VSVCBJTlRPIGFzc2V0cyAoam9iX2lkLCB0eXBlLCBzdG9yYWdlX3VybCwgYXNwZWN0X3JhdGlvLCB3YXRlcm1hcmtlZCwgZG93bmxvYWRhYmxlKVxuICAgICBWQUxVRVMgKCQxLCAkMiwgJDMsICQ0LCAkNSwgJDYpIFJFVFVSTklORyAqYCxcbiAgICBbam9iSWQsIHR5cGUsIHN0b3JhZ2VVcmwsIGFzcGVjdFJhdGlvLCB3YXRlcm1hcmtlZCwgZG93bmxvYWRhYmxlXVxuICApO1xuICByZXR1cm4gcm93c1swXTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEFzc2V0c0J5Sm9iKGpvYklkOiBzdHJpbmcpOiBQcm9taXNlPEFzc2V0Um93W10+IHtcbiAgLy8gRXhwbGljaXQgb3JkZXJpbmcgbWF0dGVyczogdGhlIFVJIHNob3dzIHRoZSBtb3N0IHJlY2VudGx5IGNyZWF0ZWQgdmlkZW9cbiAgLy8gYXMgXCJ0aGVcIiByZXN1bHQsIGFuZCB3aXRob3V0IE9SREVSIEJZLCBQb3N0Z3JlcyBkb2VzIG5vdCBndWFyYW50ZWUgcm93XG4gIC8vIG9yZGVyIGlzIGluc2VydGlvbiBvcmRlci5cbiAgY29uc3QgeyByb3dzIH0gPSBhd2FpdCBxdWVyeTxBc3NldFJvdz4oJ1NFTEVDVCAqIEZST00gYXNzZXRzIFdIRVJFIGpvYl9pZD0kMSBPUkRFUiBCWSBjcmVhdGVkX2F0IEFTQywgaWQgQVNDJywgW2pvYklkXSk7XG4gIHJldHVybiByb3dzO1xufVxuIiwgImltcG9ydCB0eXBlIHsgUmVzcG9uc2UgfSBmcm9tICdleHByZXNzJztcblxuZXhwb3J0IGNsYXNzIEFwcEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBzdGF0dXM6IG51bWJlcjtcbiAgY29kZTogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIHN0YXR1cyA9IDQwMCwgY29kZSA9ICdCQURfUkVRVUVTVCcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnQXBwRXJyb3InO1xuICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzO1xuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gIH1cbn1cblxuY29uc3QgRlJJRU5ETFlfRklFTERfTkFNRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIGVtYWlsOiAnZW1haWwgYWRkcmVzcycsXG4gIHBhc3N3b3JkOiAncGFzc3dvcmQnLFxuICB1cmw6ICd3ZWJzaXRlIFVSTCcsXG4gIHZpYmVCcmllZjogJ2Rlc2NyaXB0aW9uJyxcbiAgZHVyYXRpb25TZWNvbmRzOiAndmlkZW8gbGVuZ3RoJyxcbiAgbW9kZTogJ2dlbmVyYXRpb24gbW9kZScsXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gc2VuZEVycm9yKHJlczogUmVzcG9uc2UsIGVycjogdW5rbm93bik6IHZvaWQge1xuICBpZiAoZXJyIGluc3RhbmNlb2YgQXBwRXJyb3IpIHtcbiAgICByZXMuc3RhdHVzKGVyci5zdGF0dXMpLmpzb24oeyBlcnJvcjogZXJyLm1lc3NhZ2UsIGNvZGU6IGVyci5jb2RlIH0pO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBWYWxpZGF0aW9uIGVycm9ycyAoem9kKSBcdTIxOTIgY2xlYXIsIGZyaWVuZGx5IDQwMHMgaW5zdGVhZCBvZiBhIHNjYXJ5IDUwMFxuICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgZXJyLm5hbWUgPT09ICdab2RFcnJvcicpIHtcbiAgICBjb25zdCBpc3N1ZXMgPSAoZXJyIGFzIHVua25vd24gYXMgeyBpc3N1ZXM/OiBBcnJheTx7IHBhdGg6IChzdHJpbmcgfCBudW1iZXIpW107IG1lc3NhZ2U6IHN0cmluZyB9PiB9KS5pc3N1ZXMgPz8gW107XG4gICAgY29uc3QgZmlyc3QgPSBpc3N1ZXNbMF07XG4gICAgY29uc3QgZmllbGQgPSBmaXJzdCA/IEZSSUVORExZX0ZJRUxEX05BTUVTW1N0cmluZyhmaXJzdC5wYXRoWzBdKV0gPz8gU3RyaW5nKGZpcnN0LnBhdGhbMF0gPz8gJ2lucHV0JykgOiAnaW5wdXQnO1xuICAgIGNvbnN0IGRldGFpbCA9XG4gICAgICBmaXJzdD8ubWVzc2FnZSA9PT0gJ1JlcXVpcmVkJ1xuICAgICAgICA/IGBQbGVhc2UgcHJvdmlkZSB5b3VyICR7ZmllbGR9LmBcbiAgICAgICAgOiBmaXJzdD8ucGF0aFswXSA9PT0gJ3Bhc3N3b3JkJ1xuICAgICAgICAgID8gJ1lvdXIgcGFzc3dvcmQgbmVlZHMgdG8gYmUgYXQgbGVhc3QgNiBjaGFyYWN0ZXJzLidcbiAgICAgICAgICAvLyBDdXN0b20gLnJlZmluZSgpLy5lbWFpbCgpLy51cmwoKSBtZXNzYWdlcyBhcmUgYWxyZWFkeSBzcGVjaWZpY1xuICAgICAgICAgIC8vIGFuZCB1c2VmdWwgKGUuZy4gXCJFbnRlciBhIGZ1bGwgaHR0cHM6Ly8gbGluayBvciB1cGxvYWQgYSB2aWRlb1xuICAgICAgICAgIC8vIGZpbGUuXCIpIFx1MjAxNCBzaG93IHRoZW0gZGlyZWN0bHkgaW5zdGVhZCBvZiBhIHZhZ3VlIGZhbGxiYWNrLlxuICAgICAgICAgIDogZmlyc3Q/Lm1lc3NhZ2VcbiAgICAgICAgICAgID8gZmlyc3QubWVzc2FnZVxuICAgICAgICAgICAgOiBgUGxlYXNlIGNoZWNrIHRoZSAke2ZpZWxkfSBhbmQgdHJ5IGFnYWluLmA7XG4gICAgcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogZGV0YWlsLCBjb2RlOiAnVkFMSURBVElPTl9FUlJPUicgfSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIE1hbGZvcm1lZCBVVUlEcyBpbiBVUkwgcGFyYW1zIGhpdCBQb3N0Z3JlcyBhcyBpbnZhbGlkIGlucHV0ICgyMlAwMikuXG4gIC8vIFRvIHRoZSBjdXN0b21lciB0aGF0J3Mgc2ltcGx5IFwibm90IGZvdW5kXCIsIG5ldmVyIGEgc2VydmVyIGVycm9yLlxuICBpZiAoKGVyciBhcyB7IGNvZGU/OiBzdHJpbmcgfSk/LmNvZGUgPT09ICcyMlAwMicpIHtcbiAgICByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnSm9iIG5vdCBmb3VuZC4nLCBjb2RlOiAnTk9UX0ZPVU5EJyB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW2FwaV0gdW5oYW5kbGVkIGVycm9yOicsIGVyci5tZXNzYWdlLCBlcnIuc3RhY2spO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3IuJywgY29kZTogJ0lOVEVSTkFMX0VSUk9SJyB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0ludGVybmFsIHNlcnZlciBlcnJvci4nLCBjb2RlOiAnSU5URVJOQUxfRVJST1InIH0pO1xufVxuIiwgImltcG9ydCB7IHBvb2wgfSBmcm9tICcuL3Bvb2wuanMnO1xuXG4vKiogQXRvbWljYWxseSBncmFudHMgcHVyY2hhc2VkIGNyZWRpdHMgb25jZSBhbmQgYXR0YWNoZXMgdGhlIHBsYW4gdG8gdGhlIHNhbWUgYWNjb3VudC4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBncmFudENyZWRpdHNPbmNlKGlucHV0OiB7IGtleTogc3RyaW5nOyB1c2VySWQ6IHN0cmluZzsgY3JlZGl0czogbnVtYmVyOyBwbGFuPzogc3RyaW5nIHwgbnVsbDsgcmVhc29uOiBzdHJpbmcgfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoIU51bWJlci5pc0ludGVnZXIoaW5wdXQuY3JlZGl0cykgfHwgaW5wdXQuY3JlZGl0cyA8PSAwKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICB0cnkge1xuICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnQkVHSU4nKTtcbiAgICBjb25zdCBpbnNlcnRlZCA9IGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgIGBJTlNFUlQgSU5UTyBjcmVkaXRfZ3JhbnRzKGdyYW50X2tleSx1c2VyX2lkLGNyZWRpdHMscGxhbixyZWFzb24pIFZBTFVFUyAoJDEsJDIsJDMsJDQsJDUpIE9OIENPTkZMSUNUIERPIE5PVEhJTkcgUkVUVVJOSU5HIGdyYW50X2tleWAsXG4gICAgICBbaW5wdXQua2V5LCBpbnB1dC51c2VySWQsIGlucHV0LmNyZWRpdHMsIGlucHV0LnBsYW4gPz8gbnVsbCwgaW5wdXQucmVhc29uXSxcbiAgICApO1xuICAgIGlmICghaW5zZXJ0ZWQucm93Q291bnQpIHsgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpOyByZXR1cm4gZmFsc2U7IH1cbiAgICBhd2FpdCBjbGllbnQucXVlcnkoXG4gICAgICBgVVBEQVRFIHVzZXJzIFNFVCBjcmVkaXRzX2JhbGFuY2U9Y3JlZGl0c19iYWxhbmNlKyQxLCBwbGFuPUNPQUxFU0NFKCQyLHBsYW4pLCB1cGRhdGVkX2F0PU5PVygpIFdIRVJFIGlkPSQzYCxcbiAgICAgIFtpbnB1dC5jcmVkaXRzLCBpbnB1dC5wbGFuID8/IG51bGwsIGlucHV0LnVzZXJJZF0sXG4gICAgKTtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoYElOU0VSVCBJTlRPIGNyZWRpdF90cmFuc2FjdGlvbnModXNlcl9pZCxkZWx0YSxyZWFzb24pIFZBTFVFUyAoJDEsJDIsJDMpYCwgW2lucHV0LnVzZXJJZCwgaW5wdXQuY3JlZGl0cywgaW5wdXQucmVhc29uXSk7XG4gICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdDT01NSVQnKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBhd2FpdCBjbGllbnQucXVlcnkoJ1JPTExCQUNLJykuY2F0Y2goKCkgPT4ge30pO1xuICAgIHRocm93IGVycm9yO1xuICB9IGZpbmFsbHkgeyBjbGllbnQucmVsZWFzZSgpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBLEtBQUMsU0FBVSxNQUFNO0FBQ2I7QUFJQSxZQUFNLFdBQVc7QUFD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QUE7QUFBQSxVQUVwRCxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxPQUFRLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO0FBQUEsVUFDckQsU0FBUztBQUFBO0FBQUEsWUFFTCxDQUFDLElBQUksS0FBSyxDQUFDLEtBQU0sT0FBUSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtBQUFBO0FBQUEsWUFFL0MsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFNLE9BQVEsR0FBSyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7QUFBQSxVQUNyRDtBQUFBO0FBQUEsVUFFQSxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBUSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO0FBQUE7QUFBQSxVQUVwRCxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBUSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO0FBQUE7QUFBQSxVQUVwRCxjQUFjLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBUSxHQUFLLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO0FBQUE7QUFBQSxVQUU1RCxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBUSxHQUFLLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFO0FBQUEsVUFDbkQsU0FBUztBQUFBO0FBQUEsWUFFTCxDQUFDLElBQUksS0FBSyxDQUFDLE1BQVEsR0FBSyxLQUFPLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRTtBQUFBO0FBQUEsWUFFbEQsQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFRLElBQU0sT0FBUSxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7QUFBQSxVQUN4RDtBQUFBO0FB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QUFBQSxFQUNMO0FBQUEsRUFDQSxNQUFNLFNBQVM7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sU0FBUyxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFDQSxJQUFJLFNBQVM7QUFDVCxXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sT0FBTyxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQ3pFO0FBQUEsRUFDQSxNQUFNLFNBQVM7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sU0FBUyxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFDQSxLQUFLLFNBQVM7QUFDVixXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sUUFBUSxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFDQSxPQUFPLFNBQVM7QUFDWixXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sVUFBVSxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzVFO0FBQUEsRUFDQSxLQUFLLFNBQVM7QUFDVixXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sUUFBUSxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFDQSxNQUFNLFNBQVM7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sU0FBUyxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzNFO0FBQUEsRUFDQSxLQUFLLFNBQVM7QUFDVixXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sUUFBUSxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFDQSxPQUFPLFNBQVM7QUFDWixXQUFPLEtBQUssVUFBVSxFQUFFLE1BQU0sVUFBVSxHQUFHLFVBQVUsU0FBUyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQzVFO0FBQUEsRUFDQSxVQUFVLFNBQVM7QUFFZixX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SyxDQUFDLE9BQU8sR0FBRyxTQUFTLFVBQVU7QUFBQSxFQUNqRTtBQUFBLEVBQ0EsSUFBSSxTQUFTO0FBQ1QsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLE1BQU07QUFBQSxFQUM3RDtBQUFBLEVBQ0EsSUFBSSxTQUFTO0FBQ1QsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLE1BQU07QUFBQSxFQUM3RDtBQUFBLEVBQ0EsSUFBSSxhQUFhO0FBQ2IsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLFVBQVU7QUFBQSxFQUNqRTtBQUFBLEVBQ0EsSUFBSSxVQUFVO0FBQ1YsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLE9BQU87QUFBQSxFQUM5RDtBQUFBLEVBQ0EsSUFBSSxRQUFRO0FBQ1IsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLEtBQUs7QUFBQSxFQUM1RDtBQUFBLEVBQ0EsSUFBSSxVQUFVO0FBQ1YsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLE9BQU87QUFBQSxFQUM5RDtBQUFBLEVBQ0EsSUFBSSxTQUFTO0FBQ1QsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLE1BQU07QUFBQSxFQUM3RDtBQUFBLEVBQ0EsSUFBSSxXQUFXO0FBQ1gsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLFFBQVE7QUFBQSxFQUMvRDtBQUFBLEVBQ0EsSUFBSSxTQUFTO0FBQ1QsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLE9BQU8sS0FBSyxDQUFDLE9BQU8sR0FBRyxTQUFTLE1BQU07QUFBQSxFQUM3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O0FBQ3JFLFdBQU8sR0FBRyxjQUFjLG9DQUFvQyxJQUFJLDZCQUE2QixDQUFDO0FBQzlGLFdBQU8sR0FBRyxZQUFZLG9DQUFvQyxJQUFJLDBCQUEwQixDQUFDO0FBQUEsRUFDM0YsQ0FBQztBQUNILENBQUM7QUFFRCxLQUFLLGlGQUFpRixNQUFNO0FBQzFGLFFBQU0sUUFBUSxDQUFDLFNBQVMsU0FBUyxTQUFTLEtBQUssU0FBUyxNQUFNO0FBQzlELGFBQVcsUUFBUSxPQUFPO0FBQ3hCLFVBQU0sZUFBZSxLQUFLLFVBQVU7QUFDcEMsV0FBTyxHQUFHLEtBQUssYUFBYSxlQUFlLEdBQUcsSUFBSSxLQUFLLFNBQVMsY0FBYyxLQUFLLE9BQU8sMkJBQTJCLGFBQWEsUUFBUSxDQUFDLENBQUMsRUFBRTtBQUFBLEVBQ2hKO0FBQ0YsQ0FBQztBQUVELEtBQUssb0ZBQW9GLE1BQU07QUFDN0YsUUFBTSxRQUFRO0FBQUEsSUFDWixFQUFFLFNBQVMsU0FBUyxTQUFTLFNBQVMsRUFBRTtBQUFBLElBQ3hDLEVBQUUsU0FBUyxTQUFTLFVBQVUsU0FBUyxHQUFHO0FBQUEsSUFDMUMsRUFBRSxTQUFTLFNBQVMsVUFBVSxTQUFTLEdBQUc7QUFBQSxFQUM1QztBQUNBLGlCQUFlLFFBQVcsTUFBTTtBQUM5QixlQUFXLEVBQUUsU0FBUyxRQUFRLEtBQUssT0FBTztBQUN4QyxhQUFPLE1BQU0sUUFBUSxTQUFTLGdCQUFnQixTQUFTLE9BQU8sU0FBUyxPQUFPLENBQUM7QUFDL0UsWUFBTSxtQkFBbUIsVUFBVSx5QkFBeUIscUJBQXFCO0FBQ2pGLGFBQU8sR0FBRyxRQUFRLGFBQWEsbUJBQW1CLEdBQUcsSUFBSSxRQUFRLFNBQVMsd0JBQXdCLGlCQUFpQixRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQUEsSUFDakk7QUFBQSxFQUNGLENBQUM7QUFDSCxDQUFDO0FBRUQsS0FBSyxzRUFBc0UsTUFBTTtBQUMvRSxRQUFNLGVBQWUsYUFBYSxjQUFjO0FBQ2hELFFBQU0sWUFBWSxlQUFlLElBQUk7QUFDckMsU0FBTyxHQUFHLGdCQUFnQixZQUFZLENBQUM7QUFDdkMsU0FBTyxHQUFHLFNBQVMsU0FBUyxhQUFhLFNBQVMsU0FBUyxVQUFVLHlCQUF5QixDQUFDO0FBQ2pHLENBQUM7IiwKICAibmFtZXMiOiBbImlwYWRkciIsICJleGVjRmlsZSIsICJwcm9taXNpZnkiLCAiZXhlY0ZpbGUiLCAicHJvbWlzaWZ5IiwgImV4ZWNGaWxlQXN5bmMiLCAicHJvbWlzaWZ5IiwgImV4ZWNGaWxlIiwgImV4ZWNGaWxlQXN5bmMiLCAicHJvbWlzaWZ5IiwgImV4ZWNGaWxlIiwgInV0aWwiLCAib2JqZWN0VXRpbCIsICJlcnJvclV0aWwiLCAiZXJyb3JNYXAiLCAiand0IiwgImN0eCIsICJyZXN1bHQiLCAiaXNzdWVzIiwgImVsZW1lbnRzIiwgInByb2Nlc3NlZCIsICJyZXN1bHQiLCAiciIsICJab2RGaXJzdFBhcnR5VHlwZUtpbmQiLCAicG9vbCIsICJkYXRhIiwgInVybCJdCn0K
