var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// test/gpu-sharpen.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFile3 } from "node:child_process";
import { promisify as promisify3 } from "node:util";
import * as fs2 from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// src/lib/self-hosted.ts
import * as fs from "node:fs/promises";
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";

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

// src/lib/pool.ts
import pg from "pg";
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL not set \u2014 database features will be unavailable.");
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false }
});
pool.on("error", (err) => {
  console.error("[db] idle client error", err.message);
});

// src/lib/costs.ts
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
async function sharpenGpuClip(input, output) {
  try {
    await execFileAsync2("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      "-vf",
      "unsharp=5:5:0.6:5:5:0.0",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      output
    ], { timeout: 5 * 6e4, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    console.warn(`[gpu-video] sharpening failed, using original clip: ${error.message}`);
    await fs.copyFile(input, output);
  }
}

// test/gpu-sharpen.test.ts
var execFileAsync3 = promisify3(execFile3);
async function ffprobeCodec(file) {
  const { stdout } = await execFileAsync3("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "csv=p=0",
    file
  ]);
  return stdout.trim();
}
test("sharpenGpuClip produces a valid, decodable output clip", async () => {
  const dir = await fs2.mkdtemp(path.join(os.tmpdir(), "gpu-sharpen-"));
  try {
    const input = path.join(dir, "in.mp4");
    const output = path.join(dir, "out.mp4");
    await execFileAsync3("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:duration=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      input
    ]);
    await sharpenGpuClip(input, output);
    const codec = await ffprobeCodec(output);
    assert.equal(codec, "h264");
    const stat2 = await fs2.stat(output);
    assert.ok(stat2.size > 0);
  } finally {
    await fs2.rm(dir, { recursive: true, force: true });
  }
});
test("sharpenGpuClip preserves the audio track", async () => {
  const dir = await fs2.mkdtemp(path.join(os.tmpdir(), "gpu-sharpen-"));
  try {
    const input = path.join(dir, "in.mp4");
    const output = path.join(dir, "out.mp4");
    await execFileAsync3("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:duration=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      input
    ]);
    await sharpenGpuClip(input, output);
    const { stdout } = await execFileAsync3("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      output
    ]);
    assert.equal(stdout.trim(), "audio");
  } finally {
    await fs2.rm(dir, { recursive: true, force: true });
  }
});
test("sharpenGpuClip falls back to copying the original clip if ffmpeg fails on unreadable input", async () => {
  const dir = await fs2.mkdtemp(path.join(os.tmpdir(), "gpu-sharpen-"));
  try {
    const input = path.join(dir, "in.mp4");
    const output = path.join(dir, "out.mp4");
    await fs2.writeFile(input, "not a real video file");
    await sharpenGpuClip(input, output);
    const outputContent = await fs2.readFile(output, "utf-8");
    assert.equal(outputContent, "not a real video file");
  } finally {
    await fs2.rm(dir, { recursive: true, force: true });
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL2lwYWRkci5qc0AyLjQuMC9ub2RlX21vZHVsZXMvaXBhZGRyLmpzL2xpYi9pcGFkZHIuanMiLCAiLi4vdGVzdC9ncHUtc2hhcnBlbi50ZXN0LnRzIiwgIi4uL3NyYy9saWIvc2VsZi1ob3N0ZWQudHMiLCAiLi4vc3JjL2xpYi9jYXB0dXJlLnRzIiwgIi4uL3NyYy9saWIvc3NyZi50cyIsICIuLi9zcmMvbGliL3Bvb2wudHMiLCAiLi4vc3JjL2xpYi9jb3N0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiKGZ1bmN0aW9uIChyb290KSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIC8vIEEgbGlzdCBvZiByZWd1bGFyIGV4cHJlc3Npb25zIHRoYXQgbWF0Y2ggYXJiaXRyYXJ5IElQdjQgYWRkcmVzc2VzLFxuICAgIC8vIGZvciB3aGljaCBhIG51bWJlciBvZiB3ZWlyZCBub3RhdGlvbnMgZXhpc3QuXG4gICAgLy8gTm90ZSB0aGF0IGFuIGFkZHJlc3MgbGlrZSAwMDEwLjB4YTUuMS4xIGlzIGNvbnNpZGVyZWQgbGVnYWwuXG4gICAgY29uc3QgaXB2NFBhcnQgPSAnKDA/XFxcXGQrfDB4W2EtZjAtOV0rKSc7XG4gICAgY29uc3QgaXB2NFJlZ2V4ZXMgPSB7XG4gICAgICAgIGZvdXJPY3RldDogbmV3IFJlZ0V4cChgXiR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9JGAsICdpJyksXG4gICAgICAgIHRocmVlT2N0ZXQ6IG5ldyBSZWdFeHAoYF4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9JGAsICdpJyksXG4gICAgICAgIHR3b09jdGV0OiBuZXcgUmVnRXhwKGBeJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9JGAsICdpJyksXG4gICAgICAgIGxvbmdWYWx1ZTogbmV3IFJlZ0V4cChgXiR7aXB2NFBhcnR9JGAsICdpJylcbiAgICB9O1xuXG4gICAgLy8gUmVndWxhciBFeHByZXNzaW9uIGZvciBjaGVja2luZyBPY3RhbCBudW1iZXJzXG4gICAgY29uc3Qgb2N0YWxSZWdleCA9IG5ldyBSZWdFeHAoYF4wWzAtN10rJGAsICdpJyk7XG4gICAgY29uc3QgaGV4UmVnZXggPSBuZXcgUmVnRXhwKGBeMHhbYS1mMC05XSskYCwgJ2knKTtcblxuICAgIGNvbnN0IHpvbmVJbmRleCA9ICclWzAtOWEtel17MSx9JztcblxuICAgIC8vIElQdjYtbWF0Y2hpbmcgcmVndWxhciBleHByZXNzaW9ucy5cbiAgICAvLyBGb3IgSVB2NiwgdGhlIHRhc2sgaXMgc2ltcGxlcjogaXQgaXMgZW5vdWdoIHRvIG1hdGNoIHRoZSBjb2xvbi1kZWxpbWl0ZWRcbiAgICAvLyBoZXhhZGVjaW1hbCBJUHY2IGFuZCBhIHRyYW5zaXRpb25hbCB2YXJpYW50IHdpdGggZG90dGVkLWRlY2ltYWwgSVB2NCBhdFxuICAgIC8vIHRoZSBlbmQuXG4gICAgY29uc3QgaXB2NlBhcnQgPSAnKD86WzAtOWEtZl0rOjo/KSsnO1xuICAgIGNvbnN0IGlwdjZSZWdleGVzID0ge1xuICAgICAgICB6b25lSW5kZXg6IG5ldyBSZWdFeHAoem9uZUluZGV4LCAnaScpLFxuICAgICAgICAnbmF0aXZlJzogbmV3IFJlZ0V4cChgXig6Oik/KCR7aXB2NlBhcnR9KT8oWzAtOWEtZl0rKT8oOjopPygke3pvbmVJbmRleH0pPyRgLCAnaScpLFxuICAgICAgICBkZXByZWNhdGVkVHJhbnNpdGlvbmFsOiBuZXcgUmVnRXhwKGBeKD86OjopKCR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9KCR7em9uZUluZGV4fSk/KSRgLCAnaScpLFxuICAgICAgICB0cmFuc2l0aW9uYWw6IG5ldyBSZWdFeHAoYF4oKD86JHtpcHY2UGFydH0pfCg/Ojo6KSg/OiR7aXB2NlBhcnR9KT8pJHtpcHY0UGFydH1cXFxcLiR7aXB2NFBhcnR9XFxcXC4ke2lwdjRQYXJ0fVxcXFwuJHtpcHY0UGFydH0oJHt6b25lSW5kZXh9KT8kYCwgJ2knKVxuICAgIH07XG5cbiAgICAvLyBFeHBhbmQgOjogaW4gYW4gSVB2NiBhZGRyZXNzIG9yIGFkZHJlc3MgcGFydCBjb25zaXN0aW5nIG9mIGBwYXJ0c2AgZ3JvdXBzLlxuICAgIGZ1bmN0aW9uIGV4cGFuZElQdjYgKHN0cmluZywgcGFydHMpIHtcbiAgICAgICAgLy8gTW9yZSB0aGFuIG9uZSAnOjonIG1lYW5zIGludmFsaWQgYWRkcmVzc1xuICAgICAgICBpZiAoc3RyaW5nLmluZGV4T2YoJzo6JykgIT09IHN0cmluZy5sYXN0SW5kZXhPZignOjonKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY29sb25Db3VudCA9IDA7XG4gICAgICAgIGxldCBsYXN0Q29sb24gPSAtMTtcbiAgICAgICAgbGV0IHpvbmVJZCA9IChzdHJpbmcubWF0Y2goaXB2NlJlZ2V4ZXMuem9uZUluZGV4KSB8fCBbXSlbMF07XG4gICAgICAgIGxldCByZXBsYWNlbWVudCwgcmVwbGFjZW1lbnRDb3VudDtcblxuICAgICAgICAvLyBSZW1vdmUgem9uZSBpbmRleCBhbmQgc2F2ZSBpdCBmb3IgbGF0ZXJcbiAgICAgICAgaWYgKHpvbmVJZCkge1xuICAgICAgICAgICAgem9uZUlkID0gem9uZUlkLnN1YnN0cmluZygxKTtcbiAgICAgICAgICAgIHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKC8lLiskLywgJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSG93IG1hbnkgcGFydHMgZG8gd2UgYWxyZWFkeSBoYXZlP1xuICAgICAgICB3aGlsZSAoKGxhc3RDb2xvbiA9IHN0cmluZy5pbmRleE9mKCc6JywgbGFzdENvbG9uICsgMSkpID49IDApIHtcbiAgICAgICAgICAgIGNvbG9uQ291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDA6OjAgaXMgdHdvIHBhcnRzIG1vcmUgdGhhbiA6OlxuICAgICAgICBpZiAoc3RyaW5nLnN1YnN0cigwLCAyKSA9PT0gJzo6Jykge1xuICAgICAgICAgICAgY29sb25Db3VudC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0cmluZy5zdWJzdHIoLTIsIDIpID09PSAnOjonKSB7XG4gICAgICAgICAgICBjb2xvbkNvdW50LS07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgZm9sbG93aW5nIGxvb3Agd291bGQgaGFuZyBpZiBjb2xvbkNvdW50ID4gcGFydHNcbiAgICAgICAgaWYgKGNvbG9uQ291bnQgPiBwYXJ0cykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXBsYWNlbWVudCA9ICc6JyArICcwOicgKiAocGFydHMgLSBjb2xvbkNvdW50KVxuICAgICAgICByZXBsYWNlbWVudENvdW50ID0gcGFydHMgLSBjb2xvbkNvdW50O1xuICAgICAgICByZXBsYWNlbWVudCA9ICc6JztcbiAgICAgICAgd2hpbGUgKHJlcGxhY2VtZW50Q291bnQtLSkge1xuICAgICAgICAgICAgcmVwbGFjZW1lbnQgKz0gJzA6JztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluc2VydCB0aGUgbWlzc2luZyB6ZXJvZXNcbiAgICAgICAgc3RyaW5nID0gc3RyaW5nLnJlcGxhY2UoJzo6JywgcmVwbGFjZW1lbnQpO1xuXG4gICAgICAgIC8vIFRyaW0gYW55IGdhcmJhZ2Ugd2hpY2ggbWF5IGJlIGhhbmdpbmcgYXJvdW5kIGlmIDo6IHdhcyBhdCB0aGUgZWRnZSBpblxuICAgICAgICAvLyB0aGUgc291cmNlIHN0cmluZ1xuICAgICAgICBpZiAoc3RyaW5nWzBdID09PSAnOicpIHtcbiAgICAgICAgICAgIHN0cmluZyA9IHN0cmluZy5zbGljZSgxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdHJpbmdbc3RyaW5nLmxlbmd0aCAtIDFdID09PSAnOicpIHtcbiAgICAgICAgICAgIHN0cmluZyA9IHN0cmluZy5zbGljZSgwLCAtMSk7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJ0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zdCByZWYgPSBzdHJpbmcuc3BsaXQoJzonKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VJbnQocmVmW2ldLCAxNikpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgfSkoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGFydHM6IHBhcnRzLFxuICAgICAgICAgICAgem9uZUlkOiB6b25lSWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBBIGdlbmVyaWMgQ0lEUiAoQ2xhc3NsZXNzIEludGVyLURvbWFpbiBSb3V0aW5nKSBSRkMxNTE4IHJhbmdlIG1hdGNoZXIuXG4gICAgZnVuY3Rpb24gbWF0Y2hDSURSIChmaXJzdCwgc2Vjb25kLCBwYXJ0U2l6ZSwgY2lkckJpdHMpIHtcbiAgICAgICAgaWYgKGZpcnN0Lmxlbmd0aCAhPT0gc2Vjb25kLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGNhbm5vdCBtYXRjaCBDSURSIGZvciBvYmplY3RzIHdpdGggZGlmZmVyZW50IGxlbmd0aHMnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwYXJ0ID0gMDtcbiAgICAgICAgbGV0IHNoaWZ0O1xuXG4gICAgICAgIHdoaWxlIChjaWRyQml0cyA+IDApIHtcbiAgICAgICAgICAgIHNoaWZ0ID0gcGFydFNpemUgLSBjaWRyQml0cztcbiAgICAgICAgICAgIGlmIChzaGlmdCA8IDApIHtcbiAgICAgICAgICAgICAgICBzaGlmdCA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmaXJzdFtwYXJ0XSA+PiBzaGlmdCAhPT0gc2Vjb25kW3BhcnRdID4+IHNoaWZ0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjaWRyQml0cyAtPSBwYXJ0U2l6ZTtcbiAgICAgICAgICAgIHBhcnQgKz0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBhcnNlSW50QXV0byAoc3RyaW5nKSB7XG4gICAgICAgIC8vIEhleGFkZWNpbWFsIGJhc2UgMTYgKDB4IylcbiAgICAgICAgaWYgKGhleFJlZ2V4LnRlc3Qoc3RyaW5nKSkge1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KHN0cmluZywgMTYpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFdoaWxlIG9jdGFsIHJlcHJlc2VudGF0aW9uIGlzIGRpc2NvdXJhZ2VkIGJ5IEVDTUFTY3JpcHQgM1xuICAgICAgICAvLyBhbmQgZm9yYmlkZGVuIGJ5IEVDTUFTY3JpcHQgNSwgd2Ugc2lsZW50bHkgYWxsb3cgaXQgdG9cbiAgICAgICAgLy8gd29yayBvbmx5IGlmIHRoZSByZXN0IG9mIHRoZSBzdHJpbmcgaGFzIG51bWJlcnMgbGVzcyB0aGFuIDguXG4gICAgICAgIGlmIChzdHJpbmdbMF0gPT09ICcwJyAmJiAhaXNOYU4ocGFyc2VJbnQoc3RyaW5nWzFdLCAxMCkpKSB7XG4gICAgICAgIGlmIChvY3RhbFJlZ2V4LnRlc3Qoc3RyaW5nKSkge1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KHN0cmluZywgOCk7XG4gICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaXBhZGRyOiBjYW5ub3QgcGFyc2UgJHtzdHJpbmd9IGFzIG9jdGFsYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQWx3YXlzIGluY2x1ZGUgdGhlIGJhc2UgMTAgcmFkaXghXG4gICAgICAgIHJldHVybiBwYXJzZUludChzdHJpbmcsIDEwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwYWRQYXJ0IChwYXJ0LCBsZW5ndGgpIHtcbiAgICAgICAgd2hpbGUgKHBhcnQubGVuZ3RoIDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBwYXJ0ID0gYDAke3BhcnR9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwYXJ0O1xuICAgIH1cblxuICAgIGNvbnN0IGlwYWRkciA9IHt9O1xuXG4gICAgLy8gQW4gSVB2NCBhZGRyZXNzIChSRkM3OTEpLlxuICAgIGlwYWRkci5JUHY0ID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gQ29uc3RydWN0cyBhIG5ldyBJUHY0IGFkZHJlc3MgZnJvbSBhbiBhcnJheSBvZiBmb3VyIG9jdGV0c1xuICAgICAgICAvLyBpbiBuZXR3b3JrIG9yZGVyIChNU0IgZmlyc3QpXG4gICAgICAgIC8vIFZlcmlmaWVzIHRoZSBpbnB1dC5cbiAgICAgICAgZnVuY3Rpb24gSVB2NCAob2N0ZXRzKSB7XG4gICAgICAgICAgICBpZiAob2N0ZXRzLmxlbmd0aCAhPT0gNCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBpcHY0IG9jdGV0IGNvdW50IHNob3VsZCBiZSA0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBpLCBvY3RldDtcblxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9jdGV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG9jdGV0ID0gb2N0ZXRzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghKCgwIDw9IG9jdGV0ICYmIG9jdGV0IDw9IDI1NSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBpcHY0IG9jdGV0IHNob3VsZCBmaXQgaW4gOCBiaXRzJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm9jdGV0cyA9IG9jdGV0cztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNwZWNpYWwgSVB2NCBhZGRyZXNzIHJhbmdlcy5cbiAgICAgICAgLy8gU2VlIGFsc28gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUmVzZXJ2ZWRfSVBfYWRkcmVzc2VzXG4gICAgICAgIElQdjQucHJvdG90eXBlLlNwZWNpYWxSYW5nZXMgPSB7XG4gICAgICAgICAgICB1bnNwZWNpZmllZDogW1tuZXcgSVB2NChbMCwgMCwgMCwgMF0pLCA4XV0sXG4gICAgICAgICAgICBicm9hZGNhc3Q6IFtbbmV3IElQdjQoWzI1NSwgMjU1LCAyNTUsIDI1NV0pLCAzMl1dLFxuICAgICAgICAgICAgLy8gUkZDMzE3MVxuICAgICAgICAgICAgbXVsdGljYXN0OiBbW25ldyBJUHY0KFsyMjQsIDAsIDAsIDBdKSwgNF1dLFxuICAgICAgICAgICAgLy8gUkZDMzkyN1xuICAgICAgICAgICAgbGlua0xvY2FsOiBbW25ldyBJUHY0KFsxNjksIDI1NCwgMCwgMF0pLCAxNl1dLFxuICAgICAgICAgICAgLy8gUkZDNTczNVxuICAgICAgICAgICAgbG9vcGJhY2s6IFtbbmV3IElQdjQoWzEyNywgMCwgMCwgMF0pLCA4XV0sXG4gICAgICAgICAgICAvLyBSRkM2NTk4XG4gICAgICAgICAgICBjYXJyaWVyR3JhZGVOYXQ6IFtbbmV3IElQdjQoWzEwMCwgNjQsIDAsIDBdKSwgMTBdXSxcbiAgICAgICAgICAgIC8vIFJGQzE5MThcbiAgICAgICAgICAgICdwcml2YXRlJzogW1xuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTAsIDAsIDAsIDBdKSwgOF0sXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxNzIsIDE2LCAwLCAwXSksIDEyXSxcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE5MiwgMTY4LCAwLCAwXSksIDE2XVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIC8vIFJlc2VydmVkIGFuZCB0ZXN0aW5nLW9ubHkgcmFuZ2VzOyBSRkNzIDU3MzUsIDU3MzcsIDI1NDQsIDE3MDBcbiAgICAgICAgICAgIHJlc2VydmVkOiBbXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxOTIsIDAsIDAsIDBdKSwgMjRdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTkyLCAwLCAyLCAwXSksIDI0XSxcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE5MiwgODgsIDk5LCAwXSksIDI0XSxcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE5OCwgMTgsIDAsIDBdKSwgMTVdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTk4LCA1MSwgMTAwLCAwXSksIDI0XSxcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzIwMywgMCwgMTEzLCAwXSksIDI0XSxcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzI0MCwgMCwgMCwgMF0pLCA0XVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIC8vIFJGQzc1MzQsIFJGQzc1MzVcbiAgICAgICAgICAgIGFzMTEyOiBbXG4gICAgICAgICAgICAgICAgW25ldyBJUHY0KFsxOTIsIDE3NSwgNDgsIDBdKSwgMjRdLFxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NChbMTkyLCAzMSwgMTk2LCAwXSksIDI0XSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAvLyBSRkM3NDUwXG4gICAgICAgICAgICBhbXQ6IFtcbiAgICAgICAgICAgICAgICBbbmV3IElQdjQoWzE5MiwgNTIsIDE5MywgMF0pLCAyNF0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRoZSAna2luZCcgbWV0aG9kIGV4aXN0cyBvbiBib3RoIElQdjQgYW5kIElQdjYgY2xhc3Nlcy5cbiAgICAgICAgSVB2NC5wcm90b3R5cGUua2luZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnaXB2NCc7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ2hlY2tzIGlmIHRoaXMgYWRkcmVzcyBtYXRjaGVzIG90aGVyIG9uZSB3aXRoaW4gZ2l2ZW4gQ0lEUiByYW5nZS5cbiAgICAgICAgSVB2NC5wcm90b3R5cGUubWF0Y2ggPSBmdW5jdGlvbiAob3RoZXIsIGNpZHJSYW5nZSkge1xuICAgICAgICAgICAgbGV0IHJlZjtcbiAgICAgICAgICAgIGlmIChjaWRyUmFuZ2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlZiA9IG90aGVyO1xuICAgICAgICAgICAgICAgIG90aGVyID0gcmVmWzBdO1xuICAgICAgICAgICAgICAgIGNpZHJSYW5nZSA9IHJlZlsxXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG90aGVyLmtpbmQoKSAhPT0gJ2lwdjQnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGNhbm5vdCBtYXRjaCBpcHY0IGFkZHJlc3Mgd2l0aCBub24taXB2NCBvbmUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1hdGNoQ0lEUih0aGlzLm9jdGV0cywgb3RoZXIub2N0ZXRzLCA4LCBjaWRyUmFuZ2UpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHJldHVybnMgYSBudW1iZXIgb2YgbGVhZGluZyBvbmVzIGluIElQdjQgYWRkcmVzcywgbWFraW5nIHN1cmUgdGhhdFxuICAgICAgICAvLyB0aGUgcmVzdCBpcyBhIHNvbGlkIHNlcXVlbmNlIG9mIDAncyAodmFsaWQgbmV0bWFzaylcbiAgICAgICAgLy8gcmV0dXJucyBlaXRoZXIgdGhlIENJRFIgbGVuZ3RoIG9yIG51bGwgaWYgbWFzayBpcyBub3QgdmFsaWRcbiAgICAgICAgSVB2NC5wcm90b3R5cGUucHJlZml4TGVuZ3RoRnJvbVN1Ym5ldE1hc2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBsZXQgY2lkciA9IDA7XG4gICAgICAgICAgICAvLyBub24temVybyBlbmNvdW50ZXJlZCBzdG9wIHNjYW5uaW5nIGZvciB6ZXJvZXNcbiAgICAgICAgICAgIGxldCBzdG9wID0gZmFsc2U7XG4gICAgICAgICAgICAvLyBudW1iZXIgb2YgemVyb2VzIGluIG9jdGV0XG4gICAgICAgICAgICBjb25zdCB6ZXJvdGFibGUgPSB7XG4gICAgICAgICAgICAgICAgMDogOCxcbiAgICAgICAgICAgICAgICAxMjg6IDcsXG4gICAgICAgICAgICAgICAgMTkyOiA2LFxuICAgICAgICAgICAgICAgIDIyNDogNSxcbiAgICAgICAgICAgICAgICAyNDA6IDQsXG4gICAgICAgICAgICAgICAgMjQ4OiAzLFxuICAgICAgICAgICAgICAgIDI1MjogMixcbiAgICAgICAgICAgICAgICAyNTQ6IDEsXG4gICAgICAgICAgICAgICAgMjU1OiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbGV0IGksIG9jdGV0LCB6ZXJvcztcblxuICAgICAgICAgICAgZm9yIChpID0gMzsgaSA+PSAwOyBpIC09IDEpIHtcbiAgICAgICAgICAgICAgICBvY3RldCA9IHRoaXMub2N0ZXRzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChvY3RldCBpbiB6ZXJvdGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgemVyb3MgPSB6ZXJvdGFibGVbb2N0ZXRdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RvcCAmJiB6ZXJvcyAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoemVyb3MgIT09IDgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY2lkciArPSB6ZXJvcztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAzMiAtIGNpZHI7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ2hlY2tzIGlmIHRoZSBhZGRyZXNzIGNvcnJlc3BvbmRzIHRvIG9uZSBvZiB0aGUgc3BlY2lhbCByYW5nZXMuXG4gICAgICAgIElQdjQucHJvdG90eXBlLnJhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGlwYWRkci5zdWJuZXRNYXRjaCh0aGlzLCB0aGlzLlNwZWNpYWxSYW5nZXMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJldHVybnMgYW4gYXJyYXkgb2YgYnl0ZS1zaXplZCB2YWx1ZXMgaW4gbmV0d29yayBvcmRlciAoTVNCIGZpcnN0KVxuICAgICAgICBJUHY0LnByb3RvdHlwZS50b0J5dGVBcnJheSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9jdGV0cy5zbGljZSgwKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDb252ZXJ0cyB0aGlzIElQdjQgYWRkcmVzcyB0byBhbiBJUHY0LW1hcHBlZCBJUHY2IGFkZHJlc3MuXG4gICAgICAgIElQdjQucHJvdG90eXBlLnRvSVB2NE1hcHBlZEFkZHJlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gaXBhZGRyLklQdjYucGFyc2UoYDo6ZmZmZjoke3RoaXMudG9TdHJpbmcoKX1gKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTeW1tZXRyaWNhbCBtZXRob2Qgc3RyaWN0bHkgZm9yIGFsaWduaW5nIHdpdGggdGhlIElQdjYgbWV0aG9kcy5cbiAgICAgICAgSVB2NC5wcm90b3R5cGUudG9Ob3JtYWxpemVkU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXR1cm5zIHRoZSBhZGRyZXNzIGluIGNvbnZlbmllbnQsIGRlY2ltYWwtZG90dGVkIGZvcm1hdC5cbiAgICAgICAgSVB2NC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vY3RldHMuam9pbignLicpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBJUHY0O1xuICAgIH0pKCk7XG5cbiAgICAvLyBBIHV0aWxpdHkgZnVuY3Rpb24gdG8gcmV0dXJuIGJyb2FkY2FzdCBhZGRyZXNzIGdpdmVuIHRoZSBJUHY0IGludGVyZmFjZSBhbmQgcHJlZml4IGxlbmd0aCBpbiBDSURSIG5vdGF0aW9uXG4gICAgaXBhZGRyLklQdjQuYnJvYWRjYXN0QWRkcmVzc0Zyb21DSURSID0gZnVuY3Rpb24gKHN0cmluZykge1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaWRyID0gdGhpcy5wYXJzZUNJRFIoc3RyaW5nKTtcbiAgICAgICAgICAgIGNvbnN0IGlwSW50ZXJmYWNlT2N0ZXRzID0gY2lkclswXS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgY29uc3Qgc3VibmV0TWFza09jdGV0cyA9IHRoaXMuc3VibmV0TWFza0Zyb21QcmVmaXhMZW5ndGgoY2lkclsxXSkudG9CeXRlQXJyYXkoKTtcbiAgICAgICAgICAgIGNvbnN0IG9jdGV0cyA9IFtdO1xuICAgICAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKGkgPCA0KSB7XG4gICAgICAgICAgICAgICAgLy8gQnJvYWRjYXN0IGFkZHJlc3MgaXMgYml0d2lzZSBPUiBiZXR3ZWVuIGlwIGludGVyZmFjZSBhbmQgaW52ZXJ0ZWQgbWFza1xuICAgICAgICAgICAgICAgIG9jdGV0cy5wdXNoKHBhcnNlSW50KGlwSW50ZXJmYWNlT2N0ZXRzW2ldLCAxMCkgfCBwYXJzZUludChzdWJuZXRNYXNrT2N0ZXRzW2ldLCAxMCkgXiAyNTUpO1xuICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG5ldyB0aGlzKG9jdGV0cyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiB0aGUgYWRkcmVzcyBkb2VzIG5vdCBoYXZlIElQdjQgQ0lEUiBmb3JtYXQnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBDaGVja3MgaWYgYSBnaXZlbiBzdHJpbmcgaXMgZm9ybWF0dGVkIGxpa2UgSVB2NCBhZGRyZXNzLlxuICAgIGlwYWRkci5JUHY0LmlzSVB2NCA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VyKHN0cmluZykgIT09IG51bGw7XG4gICAgfTtcblxuICAgIC8vIENoZWNrcyBpZiBhIGdpdmVuIHN0cmluZyBpcyBhIHZhbGlkIElQdjQgYWRkcmVzcy5cbiAgICBpcGFkZHIuSVB2NC5pc1ZhbGlkID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbmV3IHRoaXModGhpcy5wYXJzZXIoc3RyaW5nKSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENoZWNrcyBpZiBhIGdpdmVuIHN0cmluZyBpcyBhIHZhbGlkIElQdjQgYWRkcmVzcyBpbiBDSURSIG5vdGF0aW9uLlxuICAgIGlwYWRkci5JUHY0LmlzVmFsaWRDSURSID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5wYXJzZUNJRFIoc3RyaW5nKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gc3RyaW5nIGlzIGEgZnVsbCBmb3VyLXBhcnQgSVB2NCBBZGRyZXNzLlxuICAgIGlwYWRkci5JUHY0LmlzVmFsaWRGb3VyUGFydERlY2ltYWwgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGlmIChpcGFkZHIuSVB2NC5pc1ZhbGlkKHN0cmluZykgJiYgc3RyaW5nLm1hdGNoKC9eKDB8WzEtOV1cXGQqKShcXC4oMHxbMS05XVxcZCopKXszfSQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gc3RyaW5nIGlzIGEgZnVsbCBmb3VyLXBhcnQgSVB2NCBBZGRyZXNzIHdpdGggQ0lEUiBwcmVmaXguXG4gICAgaXBhZGRyLklQdjQuaXNWYWxpZENJRFJGb3VyUGFydERlY2ltYWwgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gc3RyaW5nLm1hdGNoKC9eKC4rKVxcLyhcXGQrKSQvKTtcblxuICAgICAgICBpZiAoIWlwYWRkci5JUHY0LmlzVmFsaWRDSURSKHN0cmluZykgfHwgIW1hdGNoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaXBhZGRyLklQdjQuaXNWYWxpZEZvdXJQYXJ0RGVjaW1hbChtYXRjaFsxXSk7XG4gICAgfTtcblxuICAgIC8vIEEgdXRpbGl0eSBmdW5jdGlvbiB0byByZXR1cm4gbmV0d29yayBhZGRyZXNzIGdpdmVuIHRoZSBJUHY0IGludGVyZmFjZSBhbmQgcHJlZml4IGxlbmd0aCBpbiBDSURSIG5vdGF0aW9uXG4gICAgaXBhZGRyLklQdjQubmV0d29ya0FkZHJlc3NGcm9tQ0lEUiA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgbGV0IGNpZHIsIGksIGlwSW50ZXJmYWNlT2N0ZXRzLCBvY3RldHMsIHN1Ym5ldE1hc2tPY3RldHM7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNpZHIgPSB0aGlzLnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICAgICAgaXBJbnRlcmZhY2VPY3RldHMgPSBjaWRyWzBdLnRvQnl0ZUFycmF5KCk7XG4gICAgICAgICAgICBzdWJuZXRNYXNrT2N0ZXRzID0gdGhpcy5zdWJuZXRNYXNrRnJvbVByZWZpeExlbmd0aChjaWRyWzFdKS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgb2N0ZXRzID0gW107XG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlIChpIDwgNCkge1xuICAgICAgICAgICAgICAgIC8vIE5ldHdvcmsgYWRkcmVzcyBpcyBiaXR3aXNlIEFORCBiZXR3ZWVuIGlwIGludGVyZmFjZSBhbmQgbWFza1xuICAgICAgICAgICAgICAgIG9jdGV0cy5wdXNoKHBhcnNlSW50KGlwSW50ZXJmYWNlT2N0ZXRzW2ldLCAxMCkgJiBwYXJzZUludChzdWJuZXRNYXNrT2N0ZXRzW2ldLCAxMCkpO1xuICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG5ldyB0aGlzKG9jdGV0cyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiB0aGUgYWRkcmVzcyBkb2VzIG5vdCBoYXZlIElQdjQgQ0lEUiBmb3JtYXQnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBUcmllcyB0byBwYXJzZSBhbmQgdmFsaWRhdGUgYSBzdHJpbmcgd2l0aCBJUHY0IGFkZHJlc3MuXG4gICAgLy8gVGhyb3dzIGFuIGVycm9yIGlmIGl0IGZhaWxzLlxuICAgIGlwYWRkci5JUHY0LnBhcnNlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICBjb25zdCBwYXJ0cyA9IHRoaXMucGFyc2VyKHN0cmluZyk7XG5cbiAgICAgICAgaWYgKHBhcnRzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogc3RyaW5nIGlzIG5vdCBmb3JtYXR0ZWQgbGlrZSBhbiBJUHY0IEFkZHJlc3MnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgdGhpcyhwYXJ0cyk7XG4gICAgfTtcblxuICAgIC8vIFBhcnNlcyB0aGUgc3RyaW5nIGFzIGFuIElQdjQgQWRkcmVzcyB3aXRoIENJRFIgTm90YXRpb24uXG4gICAgaXBhZGRyLklQdjQucGFyc2VDSURSID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICBsZXQgbWF0Y2g7XG5cbiAgICAgICAgaWYgKChtYXRjaCA9IHN0cmluZy5tYXRjaCgvXiguKylcXC8oXFxkKykkLykpKSB7XG4gICAgICAgICAgICBjb25zdCBtYXNrTGVuZ3RoID0gcGFyc2VJbnQobWF0Y2hbMl0pO1xuICAgICAgICAgICAgaWYgKG1hc2tMZW5ndGggPj0gMCAmJiBtYXNrTGVuZ3RoIDw9IDMyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gW3RoaXMucGFyc2UobWF0Y2hbMV0pLCBtYXNrTGVuZ3RoXTtcbiAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocGFyc2VkLCAndG9TdHJpbmcnLCB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5qb2luKCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHN0cmluZyBpcyBub3QgZm9ybWF0dGVkIGxpa2UgYW4gSVB2NCBDSURSIHJhbmdlJyk7XG4gICAgfTtcblxuICAgIC8vIENsYXNzZnVsIHZhcmlhbnRzIChsaWtlIGEuYiwgd2hlcmUgYSBpcyBhbiBvY3RldCwgYW5kIGIgaXMgYSAyNC1iaXRcbiAgICAvLyB2YWx1ZSByZXByZXNlbnRpbmcgbGFzdCB0aHJlZSBvY3RldHM7IHRoaXMgY29ycmVzcG9uZHMgdG8gYSBjbGFzcyBDXG4gICAgLy8gYWRkcmVzcykgYXJlIG9taXR0ZWQgZHVlIHRvIGNsYXNzbGVzcyBuYXR1cmUgb2YgbW9kZXJuIEludGVybmV0LlxuICAgIGlwYWRkci5JUHY0LnBhcnNlciA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgbGV0IG1hdGNoLCBwYXJ0LCB2YWx1ZTtcblxuICAgICAgICAvLyBwYXJzZUludCByZWNvZ25pemVzIGFsbCB0aGF0IG9jdGFsICYgaGV4YWRlY2ltYWwgd2VpcmRuZXNzIGZvciB1c1xuICAgICAgICBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKGlwdjRSZWdleGVzLmZvdXJPY3RldCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWYgPSBtYXRjaC5zbGljZSgxLCA2KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBwYXJ0ID0gcmVmW2ldO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VJbnRBdXRvKHBhcnQpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyaW5nLm1hdGNoKGlwdjRSZWdleGVzLmxvbmdWYWx1ZSkpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHBhcnNlSW50QXV0byhtYXRjaFsxXSk7XG4gICAgICAgICAgICBpZiAodmFsdWUgPiAweGZmZmZmZmZmIHx8IHZhbHVlIDwgMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBhZGRyZXNzIG91dHNpZGUgZGVmaW5lZCByYW5nZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gKChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgICAgICAgICAgICAgIGxldCBzaGlmdDtcblxuICAgICAgICAgICAgICAgIGZvciAoc2hpZnQgPSAwOyBzaGlmdCA8PSAyNDsgc2hpZnQgKz0gOCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goKHZhbHVlID4+IHNoaWZ0KSAmIDB4ZmYpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgICAgfSkoKSkucmV2ZXJzZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKChtYXRjaCA9IHN0cmluZy5tYXRjaChpcHY0UmVnZXhlcy50d29PY3RldCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWYgPSBtYXRjaC5zbGljZSgxLCA0KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHBhcnNlSW50QXV0byhyZWZbMV0pO1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA+IDB4ZmZmZmZmIHx8IHZhbHVlIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogYWRkcmVzcyBvdXRzaWRlIGRlZmluZWQgcmFuZ2UnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VJbnRBdXRvKHJlZlswXSkpO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCgodmFsdWUgPj4gMTYpICYgMHhmZik7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKCh2YWx1ZSA+PiAgOCkgJiAweGZmKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goIHZhbHVlICAgICAgICAmIDB4ZmYpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgICB9KSgpO1xuICAgICAgICB9IGVsc2UgaWYgKChtYXRjaCA9IHN0cmluZy5tYXRjaChpcHY0UmVnZXhlcy50aHJlZU9jdGV0KSkpIHtcbiAgICAgICAgICAgIHJldHVybiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZiA9IG1hdGNoLnNsaWNlKDEsIDUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHZhbHVlID0gcGFyc2VJbnRBdXRvKHJlZlsyXSk7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID4gMHhmZmZmIHx8IHZhbHVlIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogYWRkcmVzcyBvdXRzaWRlIGRlZmluZWQgcmFuZ2UnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VJbnRBdXRvKHJlZlswXSkpO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChwYXJzZUludEF1dG8ocmVmWzFdKSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKCh2YWx1ZSA+PiA4KSAmIDB4ZmYpO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCggdmFsdWUgICAgICAgJiAweGZmKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgICAgfSkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIEEgdXRpbGl0eSBmdW5jdGlvbiB0byByZXR1cm4gc3VibmV0IG1hc2sgaW4gSVB2NCBmb3JtYXQgZ2l2ZW4gdGhlIHByZWZpeCBsZW5ndGhcbiAgICBpcGFkZHIuSVB2NC5zdWJuZXRNYXNrRnJvbVByZWZpeExlbmd0aCA9IGZ1bmN0aW9uIChwcmVmaXgpIHtcbiAgICAgICAgcHJlZml4ID0gcGFyc2VJbnQocHJlZml4KTtcbiAgICAgICAgaWYgKHByZWZpeCA8IDAgfHwgcHJlZml4ID4gMzIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiBpbnZhbGlkIElQdjQgcHJlZml4IGxlbmd0aCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2N0ZXRzID0gWzAsIDAsIDAsIDBdO1xuICAgICAgICBsZXQgaiA9IDA7XG4gICAgICAgIGNvbnN0IGZpbGxlZE9jdGV0Q291bnQgPSBNYXRoLmZsb29yKHByZWZpeCAvIDgpO1xuXG4gICAgICAgIHdoaWxlIChqIDwgZmlsbGVkT2N0ZXRDb3VudCkge1xuICAgICAgICAgICAgb2N0ZXRzW2pdID0gMjU1O1xuICAgICAgICAgICAgaisrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbGxlZE9jdGV0Q291bnQgPCA0KSB7XG4gICAgICAgICAgICBvY3RldHNbZmlsbGVkT2N0ZXRDb3VudF0gPSBNYXRoLnBvdygyLCBwcmVmaXggJSA4KSAtIDEgPDwgOCAtIChwcmVmaXggJSA4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgdGhpcyhvY3RldHMpO1xuICAgIH07XG5cbiAgICAvLyBBbiBJUHY2IGFkZHJlc3MgKFJGQzI0NjApXG4gICAgaXBhZGRyLklQdjYgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBDb25zdHJ1Y3RzIGFuIElQdjYgYWRkcmVzcyBmcm9tIGFuIGFycmF5IG9mIGVpZ2h0IDE2IC0gYml0IHBhcnRzXG4gICAgICAgIC8vIG9yIHNpeHRlZW4gOCAtIGJpdCBwYXJ0cyBpbiBuZXR3b3JrIG9yZGVyKE1TQiBmaXJzdCkuXG4gICAgICAgIC8vIFRocm93cyBhbiBlcnJvciBpZiB0aGUgaW5wdXQgaXMgaW52YWxpZC5cbiAgICAgICAgZnVuY3Rpb24gSVB2NiAocGFydHMsIHpvbmVJZCkge1xuICAgICAgICAgICAgbGV0IGksIHBhcnQ7XG5cbiAgICAgICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDE2KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJ0cyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPD0gMTQ7IGkgKz0gMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnRzLnB1c2goKHBhcnRzW2ldIDw8IDgpIHwgcGFydHNbaSArIDFdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhcnRzLmxlbmd0aCA9PT0gOCkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFydHMgPSBwYXJ0cztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGlwdjYgcGFydCBjb3VudCBzaG91bGQgYmUgOCBvciAxNicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5wYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHBhcnQgPSB0aGlzLnBhcnRzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghKCgwIDw9IHBhcnQgJiYgcGFydCA8PSAweGZmZmYpKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogaXB2NiBwYXJ0IHNob3VsZCBmaXQgaW4gMTYgYml0cycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHpvbmVJZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuem9uZUlkID0gem9uZUlkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BlY2lhbCBJUHY2IHJhbmdlc1xuICAgICAgICBJUHY2LnByb3RvdHlwZS5TcGVjaWFsUmFuZ2VzID0ge1xuICAgICAgICAgICAgLy8gUkZDNDI5MSwgaGVyZSBhbmQgYWZ0ZXJcbiAgICAgICAgICAgIHVuc3BlY2lmaWVkOiBbbmV3IElQdjYoWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMTI4XSxcbiAgICAgICAgICAgIGxpbmtMb2NhbDogW25ldyBJUHY2KFsweGZlODAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMTBdLFxuICAgICAgICAgICAgbXVsdGljYXN0OiBbbmV3IElQdjYoWzB4ZmYwMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCA4XSxcbiAgICAgICAgICAgIGxvb3BiYWNrOiBbbmV3IElQdjYoWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDFdKSwgMTI4XSxcbiAgICAgICAgICAgIHVuaXF1ZUxvY2FsOiBbbmV3IElQdjYoWzB4ZmMwMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCA3XSxcbiAgICAgICAgICAgIGlwdjRNYXBwZWQ6IFtuZXcgSVB2NihbMCwgMCwgMCwgMCwgMCwgMHhmZmZmLCAwLCAwXSksIDk2XSxcbiAgICAgICAgICAgIC8vIFJGQzM4NzlcbiAgICAgICAgICAgIGRlcHJlY2F0ZWRTaXRlTG9jYWw6IFtuZXcgSVB2NihbMHhmZWMwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSksIDEwXSxcbiAgICAgICAgICAgIC8vIFJGQzY2NjZcbiAgICAgICAgICAgIGRpc2NhcmQ6IFtuZXcgSVB2NihbMHgxMDAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgNjRdLFxuICAgICAgICAgICAgLy8gUkZDNjE0NVxuICAgICAgICAgICAgcmZjNjE0NTogW25ldyBJUHY2KFswLCAwLCAwLCAwLCAweGZmZmYsIDAsIDAsIDBdKSwgOTZdLFxuICAgICAgICAgICAgcmZjNjA1MjogW1xuICAgICAgICAgICAgICAgIC8vIFJGQzYwNTJcbiAgICAgICAgICAgICAgICBbbmV3IElQdjYoWzB4NjQsIDB4ZmY5YiwgMCwgMCwgMCwgMCwgMCwgMF0pLCA5Nl0sXG4gICAgICAgICAgICAgICAgLy8gUkZDODIxNVxuICAgICAgICAgICAgICAgIFtuZXcgSVB2NihbMHg2NCwgMHhmZjliLCAweDEsIDAsIDAsIDAsIDAsIDBdKSwgNDhdLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIC8vIFJGQzMwNTZcbiAgICAgICAgICAgICc2dG80JzogW25ldyBJUHY2KFsweDIwMDIsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMTZdLFxuICAgICAgICAgICAgLy8gUkZDNjA1MiwgUkZDNjE0NlxuICAgICAgICAgICAgdGVyZWRvOiBbbmV3IElQdjYoWzB4MjAwMSwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAzMl0sXG4gICAgICAgICAgICAvLyBSRkM1MTgwXG4gICAgICAgICAgICBiZW5jaG1hcmtpbmc6IFtuZXcgSVB2NihbMHgyMDAxLCAweDIsIDAsIDAsIDAsIDAsIDAsIDBdKSwgNDhdLFxuICAgICAgICAgICAgLy8gUkZDNzQ1MFxuICAgICAgICAgICAgYW10OiBbbmV3IElQdjYoWzB4MjAwMSwgMHgzLCAwLCAwLCAwLCAwLCAwLCAwXSksIDMyXSxcbiAgICAgICAgICAgIGFzMTEydjY6IFtcbiAgICAgICAgICAgICAgICAvLyBSRkM3NTM1XG4gICAgICAgICAgICAgICAgW25ldyBJUHY2KFsweDIwMDEsIDB4NCwgMHgxMTIsIDAsIDAsIDAsIDAsIDBdKSwgNDhdLFxuICAgICAgICAgICAgICAgIC8vIFJGQzc1MzRcbiAgICAgICAgICAgICAgICBbbmV3IElQdjYoWzB4MjYyMCwgMHg0ZiwgMHg4MDAwLCAwLCAwLCAwLCAwLCAwXSksIDQ4XSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAvLyBSRkM0ODQzXG4gICAgICAgICAgICBkZXByZWNhdGVkT3JjaGlkOiBbbmV3IElQdjYoWzB4MjAwMSwgMHgxMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAyOF0sXG4gICAgICAgICAgICAvLyBSRkM3MzQzXG4gICAgICAgICAgICBvcmNoaWQyOiBbbmV3IElQdjYoWzB4MjAwMSwgMHgyMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAyOF0sXG4gICAgICAgICAgICAvLyBSRkM5Mzc0XG4gICAgICAgICAgICBkcm9uZVJlbW90ZUlkUHJvdG9jb2xFbnRpdHlUYWdzOiBbbmV3IElQdjYoWzB4MjAwMSwgMHgzMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAyOF0sXG4gICAgICAgICAgICAvLyBSRkM5NjAyXG4gICAgICAgICAgICBzZWdtZW50Um91dGluZzogW25ldyBJUHY2KFsweDVmMDAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMTZdLFxuICAgICAgICAgICAgcmVzZXJ2ZWQ6IFtcbiAgICAgICAgICAgICAgICAvLyBSRkMzODQ5XG4gICAgICAgICAgICAgICAgW25ldyBJUHY2KFsweDIwMDEsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMjNdLFxuICAgICAgICAgICAgICAgIC8vIFJGQzI5MjhcbiAgICAgICAgICAgICAgICBbbmV3IElQdjYoWzB4MjAwMSwgMHhkYjgsIDAsIDAsIDAsIDAsIDAsIDBdKSwgMzJdLFxuICAgICAgICAgICAgICAgIC8vIFJGQzk2MzdcbiAgICAgICAgICAgICAgICBbbmV3IElQdjYoWzB4M2ZmZiwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pLCAyMF0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENoZWNrcyBpZiB0aGlzIGFkZHJlc3MgaXMgYW4gSVB2NC1tYXBwZWQgSVB2NiBhZGRyZXNzLlxuICAgICAgICBJUHY2LnByb3RvdHlwZS5pc0lQdjRNYXBwZWRBZGRyZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmFuZ2UoKSA9PT0gJ2lwdjRNYXBwZWQnO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRoZSAna2luZCcgbWV0aG9kIGV4aXN0cyBvbiBib3RoIElQdjQgYW5kIElQdjYgY2xhc3Nlcy5cbiAgICAgICAgSVB2Ni5wcm90b3R5cGUua2luZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnaXB2Nic7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ2hlY2tzIGlmIHRoaXMgYWRkcmVzcyBtYXRjaGVzIG90aGVyIG9uZSB3aXRoaW4gZ2l2ZW4gQ0lEUiByYW5nZS5cbiAgICAgICAgSVB2Ni5wcm90b3R5cGUubWF0Y2ggPSBmdW5jdGlvbiAob3RoZXIsIGNpZHJSYW5nZSkge1xuICAgICAgICAgICAgbGV0IHJlZjtcblxuICAgICAgICAgICAgaWYgKGNpZHJSYW5nZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmVmID0gb3RoZXI7XG4gICAgICAgICAgICAgICAgb3RoZXIgPSByZWZbMF07XG4gICAgICAgICAgICAgICAgY2lkclJhbmdlID0gcmVmWzFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3RoZXIua2luZCgpICE9PSAnaXB2NicpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogY2Fubm90IG1hdGNoIGlwdjYgYWRkcmVzcyB3aXRoIG5vbi1pcHY2IG9uZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hDSURSKHRoaXMucGFydHMsIG90aGVyLnBhcnRzLCAxNiwgY2lkclJhbmdlKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyByZXR1cm5zIGEgbnVtYmVyIG9mIGxlYWRpbmcgb25lcyBpbiBJUHY2IGFkZHJlc3MsIG1ha2luZyBzdXJlIHRoYXRcbiAgICAgICAgLy8gdGhlIHJlc3QgaXMgYSBzb2xpZCBzZXF1ZW5jZSBvZiAwJ3MgKHZhbGlkIG5ldG1hc2spXG4gICAgICAgIC8vIHJldHVybnMgZWl0aGVyIHRoZSBDSURSIGxlbmd0aCBvciBudWxsIGlmIG1hc2sgaXMgbm90IHZhbGlkXG4gICAgICAgIElQdjYucHJvdG90eXBlLnByZWZpeExlbmd0aEZyb21TdWJuZXRNYXNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbGV0IGNpZHIgPSAwO1xuICAgICAgICAgICAgLy8gbm9uLXplcm8gZW5jb3VudGVyZWQgc3RvcCBzY2FubmluZyBmb3IgemVyb2VzXG4gICAgICAgICAgICBsZXQgc3RvcCA9IGZhbHNlO1xuICAgICAgICAgICAgLy8gbnVtYmVyIG9mIHplcm9lcyBpbiBvY3RldFxuICAgICAgICAgICAgY29uc3QgemVyb3RhYmxlID0ge1xuICAgICAgICAgICAgICAgIDA6IDE2LFxuICAgICAgICAgICAgICAgIDMyNzY4OiAxNSxcbiAgICAgICAgICAgICAgICA0OTE1MjogMTQsXG4gICAgICAgICAgICAgICAgNTczNDQ6IDEzLFxuICAgICAgICAgICAgICAgIDYxNDQwOiAxMixcbiAgICAgICAgICAgICAgICA2MzQ4ODogMTEsXG4gICAgICAgICAgICAgICAgNjQ1MTI6IDEwLFxuICAgICAgICAgICAgICAgIDY1MDI0OiA5LFxuICAgICAgICAgICAgICAgIDY1MjgwOiA4LFxuICAgICAgICAgICAgICAgIDY1NDA4OiA3LFxuICAgICAgICAgICAgICAgIDY1NDcyOiA2LFxuICAgICAgICAgICAgICAgIDY1NTA0OiA1LFxuICAgICAgICAgICAgICAgIDY1NTIwOiA0LFxuICAgICAgICAgICAgICAgIDY1NTI4OiAzLFxuICAgICAgICAgICAgICAgIDY1NTMyOiAyLFxuICAgICAgICAgICAgICAgIDY1NTM0OiAxLFxuICAgICAgICAgICAgICAgIDY1NTM1OiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbGV0IHBhcnQsIHplcm9zO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gNzsgaSA+PSAwOyBpIC09IDEpIHtcbiAgICAgICAgICAgICAgICBwYXJ0ID0gdGhpcy5wYXJ0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAocGFydCBpbiB6ZXJvdGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgemVyb3MgPSB6ZXJvdGFibGVbcGFydF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdG9wICYmIHplcm9zICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh6ZXJvcyAhPT0gMTYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3AgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY2lkciArPSB6ZXJvcztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAxMjggLSBjaWRyO1xuICAgICAgICB9O1xuXG5cbiAgICAgICAgLy8gQ2hlY2tzIGlmIHRoZSBhZGRyZXNzIGNvcnJlc3BvbmRzIHRvIG9uZSBvZiB0aGUgc3BlY2lhbCByYW5nZXMuXG4gICAgICAgIElQdjYucHJvdG90eXBlLnJhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGlwYWRkci5zdWJuZXRNYXRjaCh0aGlzLCB0aGlzLlNwZWNpYWxSYW5nZXMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJldHVybnMgYW4gYXJyYXkgb2YgYnl0ZS1zaXplZCB2YWx1ZXMgaW4gbmV0d29yayBvcmRlciAoTVNCIGZpcnN0KVxuICAgICAgICBJUHY2LnByb3RvdHlwZS50b0J5dGVBcnJheSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxldCBwYXJ0O1xuICAgICAgICAgICAgY29uc3QgYnl0ZXMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHRoaXMucGFydHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHBhcnQgPSByZWZbaV07XG4gICAgICAgICAgICAgICAgYnl0ZXMucHVzaChwYXJ0ID4+IDgpO1xuICAgICAgICAgICAgICAgIGJ5dGVzLnB1c2gocGFydCAmIDB4ZmYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYnl0ZXM7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmV0dXJucyB0aGUgYWRkcmVzcyBpbiBleHBhbmRlZCBmb3JtYXQgd2l0aCBhbGwgemVyb2VzIGluY2x1ZGVkLCBsaWtlXG4gICAgICAgIC8vIDIwMDE6MGRiODowMDA4OjAwNjY6MDAwMDowMDAwOjAwMDA6MDAwMVxuICAgICAgICBJUHY2LnByb3RvdHlwZS50b0ZpeGVkTGVuZ3RoU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc3QgYWRkciA9ICgoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHBhZFBhcnQodGhpcy5wYXJ0c1tpXS50b1N0cmluZygxNiksIDQpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgICAgIH0pLmNhbGwodGhpcykpLmpvaW4oJzonKTtcblxuICAgICAgICAgICAgbGV0IHN1ZmZpeCA9ICcnO1xuXG4gICAgICAgICAgICBpZiAodGhpcy56b25lSWQpIHtcbiAgICAgICAgICAgICAgICBzdWZmaXggPSBgJSR7dGhpcy56b25lSWR9YDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGFkZHIgKyBzdWZmaXg7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ29udmVydHMgdGhpcyBhZGRyZXNzIHRvIElQdjQgYWRkcmVzcyBpZiBpdCBpcyBhbiBJUHY0LW1hcHBlZCBJUHY2IGFkZHJlc3MuXG4gICAgICAgIC8vIFRocm93cyBhbiBlcnJvciBvdGhlcndpc2UuXG4gICAgICAgIElQdjYucHJvdG90eXBlLnRvSVB2NEFkZHJlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNJUHY0TWFwcGVkQWRkcmVzcygpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHRyeWluZyB0byBjb252ZXJ0IGEgZ2VuZXJpYyBpcHY2IGFkZHJlc3MgdG8gaXB2NCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZWYgPSB0aGlzLnBhcnRzLnNsaWNlKC0yKTtcbiAgICAgICAgICAgIGNvbnN0IGhpZ2ggPSByZWZbMF07XG4gICAgICAgICAgICBjb25zdCBsb3cgPSByZWZbMV07XG5cbiAgICAgICAgICAgIHJldHVybiBuZXcgaXBhZGRyLklQdjQoW2hpZ2ggPj4gOCwgaGlnaCAmIDB4ZmYsIGxvdyA+PiA4LCBsb3cgJiAweGZmXSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmV0dXJucyB0aGUgYWRkcmVzcyBpbiBleHBhbmRlZCBmb3JtYXQgd2l0aCBhbGwgemVyb2VzIGluY2x1ZGVkLCBsaWtlXG4gICAgICAgIC8vIDIwMDE6ZGI4Ojg6NjY6MDowOjA6MVxuICAgICAgICAvL1xuICAgICAgICAvLyBEZXByZWNhdGVkOiB1c2UgdG9GaXhlZExlbmd0aFN0cmluZygpIGluc3RlYWQuXG4gICAgICAgIElQdjYucHJvdG90eXBlLnRvTm9ybWFsaXplZFN0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnN0IGFkZHIgPSAoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMucGFydHNbaV0udG9TdHJpbmcoMTYpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgICAgIH0pLmNhbGwodGhpcykpLmpvaW4oJzonKTtcblxuICAgICAgICAgICAgbGV0IHN1ZmZpeCA9ICcnO1xuXG4gICAgICAgICAgICBpZiAodGhpcy56b25lSWQpIHtcbiAgICAgICAgICAgICAgICBzdWZmaXggPSBgJSR7dGhpcy56b25lSWR9YDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGFkZHIgKyBzdWZmaXg7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmV0dXJucyB0aGUgYWRkcmVzcyBpbiBjb21wYWN0LCBodW1hbi1yZWFkYWJsZSBmb3JtYXQgbGlrZVxuICAgICAgICAvLyAyMDAxOmRiODo4OjY2OjoxXG4gICAgICAgIC8vIGluIGxpbmUgd2l0aCBSRkMgNTk1MiAoc2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM1OTUyI3NlY3Rpb24tNClcbiAgICAgICAgSVB2Ni5wcm90b3R5cGUudG9SRkM1OTUyU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc3QgcmVnZXggPSAvKChefDopKDAoOnwkKSl7Mix9KS9nO1xuICAgICAgICAgICAgY29uc3Qgc3RyaW5nID0gdGhpcy50b05vcm1hbGl6ZWRTdHJpbmcoKTtcbiAgICAgICAgICAgIGxldCBiZXN0TWF0Y2hJbmRleCA9IDA7XG4gICAgICAgICAgICBsZXQgYmVzdE1hdGNoTGVuZ3RoID0gLTE7XG4gICAgICAgICAgICBsZXQgbWF0Y2g7XG5cbiAgICAgICAgICAgIHdoaWxlICgobWF0Y2ggPSByZWdleC5leGVjKHN0cmluZykpKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoWzBdLmxlbmd0aCA+IGJlc3RNYXRjaExlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBiZXN0TWF0Y2hJbmRleCA9IG1hdGNoLmluZGV4O1xuICAgICAgICAgICAgICAgICAgICBiZXN0TWF0Y2hMZW5ndGggPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYmVzdE1hdGNoTGVuZ3RoIDwgMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdHJpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBgJHtzdHJpbmcuc3Vic3RyaW5nKDAsIGJlc3RNYXRjaEluZGV4KX06OiR7c3RyaW5nLnN1YnN0cmluZyhiZXN0TWF0Y2hJbmRleCArIGJlc3RNYXRjaExlbmd0aCl9YDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXR1cm5zIHRoZSBhZGRyZXNzIGluIGNvbXBhY3QsIGh1bWFuLXJlYWRhYmxlIGZvcm1hdCBsaWtlXG4gICAgICAgIC8vIDIwMDE6ZGI4Ojg6NjY6OjFcbiAgICAgICAgLy8gQ2FsbHMgdG9SRkM1OTUyU3RyaW5nIHVuZGVyIHRoZSBob29kLlxuICAgICAgICBJUHY2LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvUkZDNTk1MlN0cmluZygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBJUHY2O1xuXG4gICAgfSkoKTtcblxuICAgIC8vIEEgdXRpbGl0eSBmdW5jdGlvbiB0byByZXR1cm4gYnJvYWRjYXN0IGFkZHJlc3MgZ2l2ZW4gdGhlIElQdjYgaW50ZXJmYWNlIGFuZCBwcmVmaXggbGVuZ3RoIGluIENJRFIgbm90YXRpb25cbiAgICBpcGFkZHIuSVB2Ni5icm9hZGNhc3RBZGRyZXNzRnJvbUNJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaWRyID0gdGhpcy5wYXJzZUNJRFIoc3RyaW5nKTtcbiAgICAgICAgICAgIGNvbnN0IGlwSW50ZXJmYWNlT2N0ZXRzID0gY2lkclswXS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgY29uc3Qgc3VibmV0TWFza09jdGV0cyA9IHRoaXMuc3VibmV0TWFza0Zyb21QcmVmaXhMZW5ndGgoY2lkclsxXSkudG9CeXRlQXJyYXkoKTtcbiAgICAgICAgICAgIGNvbnN0IG9jdGV0cyA9IFtdO1xuICAgICAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKGkgPCAxNikge1xuICAgICAgICAgICAgICAgIC8vIEJyb2FkY2FzdCBhZGRyZXNzIGlzIGJpdHdpc2UgT1IgYmV0d2VlbiBpcCBpbnRlcmZhY2UgYW5kIGludmVydGVkIG1hc2tcbiAgICAgICAgICAgICAgICBvY3RldHMucHVzaChwYXJzZUludChpcEludGVyZmFjZU9jdGV0c1tpXSwgMTApIHwgcGFyc2VJbnQoc3VibmV0TWFza09jdGV0c1tpXSwgMTApIF4gMjU1KTtcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBuZXcgdGhpcyhvY3RldHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlwYWRkcjogdGhlIGFkZHJlc3MgZG9lcyBub3QgaGF2ZSBJUHY2IENJRFIgZm9ybWF0ICgke2V9KWApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENoZWNrcyBpZiBhIGdpdmVuIHN0cmluZyBpcyBmb3JtYXR0ZWQgbGlrZSBJUHY2IGFkZHJlc3MuXG4gICAgaXBhZGRyLklQdjYuaXNJUHY2ID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZXIoc3RyaW5nKSAhPT0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIHRvIHNlZSBpZiBzdHJpbmcgaXMgYSB2YWxpZCBJUHY2IEFkZHJlc3NcbiAgICBpcGFkZHIuSVB2Ni5pc1ZhbGlkID0gZnVuY3Rpb24gKHN0cmluZykge1xuXG4gICAgICAgIC8vIFNpbmNlIElQdjYuaXNWYWxpZCBpcyBhbHdheXMgY2FsbGVkIGZpcnN0LCB0aGlzIHNob3J0Y3V0XG4gICAgICAgIC8vIHByb3ZpZGVzIGEgc3Vic3RhbnRpYWwgcGVyZm9ybWFuY2UgZ2Fpbi5cbiAgICAgICAgaWYgKHR5cGVvZiBzdHJpbmcgPT09ICdzdHJpbmcnICYmIHN0cmluZy5pbmRleE9mKCc6JykgPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYWRkciA9IHRoaXMucGFyc2VyKHN0cmluZyk7XG4gICAgICAgICAgICBuZXcgdGhpcyhhZGRyLnBhcnRzLCBhZGRyLnpvbmVJZCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIENoZWNrcyBpZiBhIGdpdmVuIHN0cmluZyBpcyBhIHZhbGlkIElQdjYgYWRkcmVzcyBpbiBDSURSIG5vdGF0aW9uLlxuICAgIGlwYWRkci5JUHY2LmlzVmFsaWRDSURSID0gZnVuY3Rpb24gKHN0cmluZykge1xuXG4gICAgICAgIC8vIFNlZSBub3RlIGluIElQdjYuaXNWYWxpZFxuICAgICAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycgJiYgc3RyaW5nLmluZGV4T2YoJzonKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLnBhcnNlQ0lEUihzdHJpbmcpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBBIHV0aWxpdHkgZnVuY3Rpb24gdG8gcmV0dXJuIG5ldHdvcmsgYWRkcmVzcyBnaXZlbiB0aGUgSVB2NiBpbnRlcmZhY2UgYW5kIHByZWZpeCBsZW5ndGggaW4gQ0lEUiBub3RhdGlvblxuICAgIGlwYWRkci5JUHY2Lm5ldHdvcmtBZGRyZXNzRnJvbUNJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGxldCBjaWRyLCBpLCBpcEludGVyZmFjZU9jdGV0cywgb2N0ZXRzLCBzdWJuZXRNYXNrT2N0ZXRzO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjaWRyID0gdGhpcy5wYXJzZUNJRFIoc3RyaW5nKTtcbiAgICAgICAgICAgIGlwSW50ZXJmYWNlT2N0ZXRzID0gY2lkclswXS50b0J5dGVBcnJheSgpO1xuICAgICAgICAgICAgc3VibmV0TWFza09jdGV0cyA9IHRoaXMuc3VibmV0TWFza0Zyb21QcmVmaXhMZW5ndGgoY2lkclsxXSkudG9CeXRlQXJyYXkoKTtcbiAgICAgICAgICAgIG9jdGV0cyA9IFtdO1xuICAgICAgICAgICAgaSA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoaSA8IDE2KSB7XG4gICAgICAgICAgICAgICAgLy8gTmV0d29yayBhZGRyZXNzIGlzIGJpdHdpc2UgQU5EIGJldHdlZW4gaXAgaW50ZXJmYWNlIGFuZCBtYXNrXG4gICAgICAgICAgICAgICAgb2N0ZXRzLnB1c2gocGFyc2VJbnQoaXBJbnRlcmZhY2VPY3RldHNbaV0sIDEwKSAmIHBhcnNlSW50KHN1Ym5ldE1hc2tPY3RldHNbaV0sIDEwKSk7XG4gICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbmV3IHRoaXMob2N0ZXRzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpcGFkZHI6IHRoZSBhZGRyZXNzIGRvZXMgbm90IGhhdmUgSVB2NiBDSURSIGZvcm1hdCAoJHtlfSlgKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBUcmllcyB0byBwYXJzZSBhbmQgdmFsaWRhdGUgYSBzdHJpbmcgd2l0aCBJUHY2IGFkZHJlc3MuXG4gICAgLy8gVGhyb3dzIGFuIGVycm9yIGlmIGl0IGZhaWxzLlxuICAgIGlwYWRkci5JUHY2LnBhcnNlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICBjb25zdCBhZGRyID0gdGhpcy5wYXJzZXIoc3RyaW5nKTtcblxuICAgICAgICBpZiAoYWRkci5wYXJ0cyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IHN0cmluZyBpcyBub3QgZm9ybWF0dGVkIGxpa2UgYW4gSVB2NiBBZGRyZXNzJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IHRoaXMoYWRkci5wYXJ0cywgYWRkci56b25lSWQpO1xuICAgIH07XG5cbiAgICBpcGFkZHIuSVB2Ni5wYXJzZUNJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGxldCBtYXNrTGVuZ3RoLCBtYXRjaCwgcGFyc2VkO1xuXG4gICAgICAgIGlmICgobWF0Y2ggPSBzdHJpbmcubWF0Y2goL14oLispXFwvKFxcZCspJC8pKSkge1xuICAgICAgICAgICAgbWFza0xlbmd0aCA9IHBhcnNlSW50KG1hdGNoWzJdKTtcbiAgICAgICAgICAgIGlmIChtYXNrTGVuZ3RoID49IDAgJiYgbWFza0xlbmd0aCA8PSAxMjgpIHtcbiAgICAgICAgICAgICAgICBwYXJzZWQgPSBbdGhpcy5wYXJzZShtYXRjaFsxXSksIG1hc2tMZW5ndGhdO1xuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwYXJzZWQsICd0b1N0cmluZycsIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmpvaW4oJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogc3RyaW5nIGlzIG5vdCBmb3JtYXR0ZWQgbGlrZSBhbiBJUHY2IENJRFIgcmFuZ2UnKTtcbiAgICB9O1xuXG4gICAgLy8gUGFyc2UgYW4gSVB2NiBhZGRyZXNzLlxuICAgIGlwYWRkci5JUHY2LnBhcnNlciA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgbGV0IGFkZHIsIGksIG1hdGNoLCBvY3RldCwgb2N0ZXRzLCB6b25lSWQ7XG5cbiAgICAgICAgaWYgKChtYXRjaCA9IHN0cmluZy5tYXRjaChpcHY2UmVnZXhlcy5kZXByZWNhdGVkVHJhbnNpdGlvbmFsKSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlcihgOjpmZmZmOiR7bWF0Y2hbMV19YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlwdjZSZWdleGVzLm5hdGl2ZS50ZXN0KHN0cmluZykpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBhbmRJUHY2KHN0cmluZywgOCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChtYXRjaCA9IHN0cmluZy5tYXRjaChpcHY2UmVnZXhlcy50cmFuc2l0aW9uYWwpKSkge1xuICAgICAgICAgICAgem9uZUlkID0gbWF0Y2hbNl0gfHwgJyc7XG4gICAgICAgICAgICBhZGRyID0gbWF0Y2hbMV1cbiAgICAgICAgICAgIGlmICghbWF0Y2hbMV0uZW5kc1dpdGgoJzo6JykpIHtcbiAgICAgICAgICAgICAgICBhZGRyID0gYWRkci5zbGljZSgwLCAtMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFkZHIgPSBleHBhbmRJUHY2KGFkZHIgKyB6b25lSWQsIDYpO1xuICAgICAgICAgICAgaWYgKGFkZHIucGFydHMpIHtcbiAgICAgICAgICAgICAgICBvY3RldHMgPSBbXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KG1hdGNoWzJdKSxcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VJbnQobWF0Y2hbM10pLFxuICAgICAgICAgICAgICAgICAgICBwYXJzZUludChtYXRjaFs0XSksXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KG1hdGNoWzVdKVxuICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9jdGV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBvY3RldCA9IG9jdGV0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoKDAgPD0gb2N0ZXQgJiYgb2N0ZXQgPD0gMjU1KSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYWRkci5wYXJ0cy5wdXNoKG9jdGV0c1swXSA8PCA4IHwgb2N0ZXRzWzFdKTtcbiAgICAgICAgICAgICAgICBhZGRyLnBhcnRzLnB1c2gob2N0ZXRzWzJdIDw8IDggfCBvY3RldHNbM10pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHBhcnRzOiBhZGRyLnBhcnRzLFxuICAgICAgICAgICAgICAgICAgICB6b25lSWQ6IGFkZHIuem9uZUlkXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICAvLyBBIHV0aWxpdHkgZnVuY3Rpb24gdG8gcmV0dXJuIHN1Ym5ldCBtYXNrIGluIElQdjYgZm9ybWF0IGdpdmVuIHRoZSBwcmVmaXggbGVuZ3RoXG4gICAgaXBhZGRyLklQdjYuc3VibmV0TWFza0Zyb21QcmVmaXhMZW5ndGggPSBmdW5jdGlvbiAocHJlZml4KSB7XG4gICAgICAgIHByZWZpeCA9IHBhcnNlSW50KHByZWZpeCk7XG4gICAgICAgIGlmIChwcmVmaXggPCAwIHx8IHByZWZpeCA+IDEyOCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpcGFkZHI6IGludmFsaWQgSVB2NiBwcmVmaXggbGVuZ3RoJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvY3RldHMgPSBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF07XG4gICAgICAgIGxldCBqID0gMDtcbiAgICAgICAgY29uc3QgZmlsbGVkT2N0ZXRDb3VudCA9IE1hdGguZmxvb3IocHJlZml4IC8gOCk7XG5cbiAgICAgICAgd2hpbGUgKGogPCBmaWxsZWRPY3RldENvdW50KSB7XG4gICAgICAgICAgICBvY3RldHNbal0gPSAyNTU7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmlsbGVkT2N0ZXRDb3VudCA8IDE2KSB7XG4gICAgICAgICAgICBvY3RldHNbZmlsbGVkT2N0ZXRDb3VudF0gPSBNYXRoLnBvdygyLCBwcmVmaXggJSA4KSAtIDEgPDwgOCAtIChwcmVmaXggJSA4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgdGhpcyhvY3RldHMpO1xuICAgIH07XG5cbiAgICAvLyBUcnkgdG8gcGFyc2UgYW4gYXJyYXkgaW4gbmV0d29yayBvcmRlciAoTVNCIGZpcnN0KSBmb3IgSVB2NCBhbmQgSVB2NlxuICAgIGlwYWRkci5mcm9tQnl0ZUFycmF5ID0gZnVuY3Rpb24gKGJ5dGVzKSB7XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9IGJ5dGVzLmxlbmd0aDtcblxuICAgICAgICBpZiAobGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGlwYWRkci5JUHY0KGJ5dGVzKTtcbiAgICAgICAgfSBlbHNlIGlmIChsZW5ndGggPT09IDE2KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGlwYWRkci5JUHY2KGJ5dGVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiB0aGUgYmluYXJ5IGlucHV0IGlzIG5laXRoZXIgYW4gSVB2NiBub3IgSVB2NCBhZGRyZXNzJyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gQ2hlY2tzIGlmIHRoZSBhZGRyZXNzIGlzIHZhbGlkIElQIGFkZHJlc3NcbiAgICBpcGFkZHIuaXNWYWxpZCA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGlwYWRkci5JUHY2LmlzVmFsaWQoc3RyaW5nKSB8fCBpcGFkZHIuSVB2NC5pc1ZhbGlkKHN0cmluZyk7XG4gICAgfTtcblxuICAgIC8vIENoZWNrcyBpZiB0aGUgYWRkcmVzcyBpcyB2YWxpZCBJUCBhZGRyZXNzIGluIENJRFIgbm90YXRpb25cbiAgICBpcGFkZHIuaXNWYWxpZENJRFIgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBpcGFkZHIuSVB2Ni5pc1ZhbGlkQ0lEUihzdHJpbmcpIHx8IGlwYWRkci5JUHY0LmlzVmFsaWRDSURSKHN0cmluZyk7XG4gICAgfTtcblxuXG4gICAgLy8gQXR0ZW1wdHMgdG8gcGFyc2UgYW4gSVAgQWRkcmVzcywgZmlyc3QgdGhyb3VnaCBJUHY2IHRoZW4gSVB2NC5cbiAgICAvLyBUaHJvd3MgYW4gZXJyb3IgaWYgaXQgY291bGQgbm90IGJlIHBhcnNlZC5cbiAgICBpcGFkZHIucGFyc2UgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGlmIChpcGFkZHIuSVB2Ni5pc1ZhbGlkKHN0cmluZykpIHtcbiAgICAgICAgICAgIHJldHVybiBpcGFkZHIuSVB2Ni5wYXJzZShzdHJpbmcpO1xuICAgICAgICB9IGVsc2UgaWYgKGlwYWRkci5JUHY0LmlzVmFsaWQoc3RyaW5nKSkge1xuICAgICAgICAgICAgcmV0dXJuIGlwYWRkci5JUHY0LnBhcnNlKHN0cmluZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lwYWRkcjogdGhlIGFkZHJlc3MgaGFzIG5laXRoZXIgSVB2NiBub3IgSVB2NCBmb3JtYXQnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBBdHRlbXB0IHRvIHBhcnNlIENJRFIgbm90YXRpb24sIGZpcnN0IHRocm91Z2ggSVB2NiB0aGVuIElQdjQuXG4gICAgLy8gVGhyb3dzIGFuIGVycm9yIGlmIGl0IGNvdWxkIG5vdCBiZSBwYXJzZWQuXG4gICAgaXBhZGRyLnBhcnNlQ0lEUiA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBpcGFkZHIuSVB2Ni5wYXJzZUNJRFIoc3RyaW5nKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXBhZGRyLklQdjQucGFyc2VDSURSKHN0cmluZyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlMikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaXBhZGRyOiB0aGUgYWRkcmVzcyBoYXMgbmVpdGhlciBJUHY2IG5vciBJUHY0IENJRFIgZm9ybWF0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUGFyc2UgYW4gYWRkcmVzcyBhbmQgcmV0dXJuIHBsYWluIElQdjQgYWRkcmVzcyBpZiBpdCBpcyBhbiBJUHY0LW1hcHBlZCBhZGRyZXNzXG4gICAgaXBhZGRyLnByb2Nlc3MgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGFkZHIgPSB0aGlzLnBhcnNlKHN0cmluZyk7XG5cbiAgICAgICAgaWYgKGFkZHIua2luZCgpID09PSAnaXB2NicgJiYgYWRkci5pc0lQdjRNYXBwZWRBZGRyZXNzKCkpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRyLnRvSVB2NEFkZHJlc3MoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRyO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIEFuIHV0aWxpdHkgZnVuY3Rpb24gdG8gZWFzZSBuYW1lZCByYW5nZSBtYXRjaGluZy4gU2VlIGV4YW1wbGVzIGJlbG93LlxuICAgIC8vIHJhbmdlTGlzdCBjYW4gY29udGFpbiBib3RoIElQdjQgYW5kIElQdjYgc3VibmV0IGVudHJpZXMgYW5kIHdpbGwgbm90IHRocm93IGVycm9yc1xuICAgIC8vIG9uIG1hdGNoaW5nIElQdjQgYWRkcmVzc2VzIHRvIElQdjYgcmFuZ2VzIG9yIHZpY2UgdmVyc2EuXG4gICAgaXBhZGRyLnN1Ym5ldE1hdGNoID0gZnVuY3Rpb24gKGFkZHJlc3MsIHJhbmdlTGlzdCwgZGVmYXVsdE5hbWUpIHtcbiAgICAgICAgbGV0IGksIHJhbmdlTmFtZSwgcmFuZ2VTdWJuZXRzLCBzdWJuZXQ7XG5cbiAgICAgICAgaWYgKGRlZmF1bHROYW1lID09PSB1bmRlZmluZWQgfHwgZGVmYXVsdE5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGRlZmF1bHROYW1lID0gJ3VuaWNhc3QnO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChyYW5nZU5hbWUgaW4gcmFuZ2VMaXN0KSB7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHJhbmdlTGlzdCwgcmFuZ2VOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJhbmdlU3VibmV0cyA9IHJhbmdlTGlzdFtyYW5nZU5hbWVdO1xuICAgICAgICAgICAgICAgIC8vIEVDTUE1IEFycmF5LmlzQXJyYXkgaXNuJ3QgYXZhaWxhYmxlIGV2ZXJ5d2hlcmVcbiAgICAgICAgICAgICAgICBpZiAocmFuZ2VTdWJuZXRzWzBdICYmICEocmFuZ2VTdWJuZXRzWzBdIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJhbmdlU3VibmV0cyA9IFtyYW5nZVN1Ym5ldHNdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCByYW5nZVN1Ym5ldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc3VibmV0ID0gcmFuZ2VTdWJuZXRzW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWRkcmVzcy5raW5kKCkgPT09IHN1Ym5ldFswXS5raW5kKCkgJiYgYWRkcmVzcy5tYXRjaC5hcHBseShhZGRyZXNzLCBzdWJuZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmFuZ2VOYW1lO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlZmF1bHROYW1lO1xuICAgIH07XG5cbiAgICAvLyBFeHBvcnQgZm9yIGJvdGggdGhlIENvbW1vbkpTIGFuZCBicm93c2VyLWxpa2UgZW52aXJvbm1lbnRcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBpcGFkZHI7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICByb290LmlwYWRkciA9IGlwYWRkcjtcbiAgICB9XG5cbn0odGhpcykpO1xuIiwgImltcG9ydCB7IHRlc3QgfSBmcm9tICdub2RlOnRlc3QnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydC9zdHJpY3QnO1xuaW1wb3J0IHsgZXhlY0ZpbGUgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnbm9kZTpvcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBzaGFycGVuR3B1Q2xpcCB9IGZyb20gJy4uL3NyYy9saWIvc2VsZi1ob3N0ZWQuanMnO1xuXG5jb25zdCBleGVjRmlsZUFzeW5jID0gcHJvbWlzaWZ5KGV4ZWNGaWxlKTtcblxuLyoqXG4gKiBSZWFsLCBuby1tb2NrIGNvdmVyYWdlIGZvciB0aGUgR1BVLWNsaXAgcG9zdC1wcm9jZXNzaW5nIHNoYXJwZW5pbmcgYWRkZWRcbiAqIHRvIGFkZHJlc3MgYSByZWFsIHF1YWxpdHkgY29tcGxhaW50OiB0aGUgc2VsZi1ob3N0ZWQgd29ya2VyIHJ1bnNcbiAqIHdhbjIuMi10aTJ2LTViLCBhIHNtYWxsICg1QiBwYXJhbWV0ZXIpIG9wZW4gdmlkZW8gbW9kZWwgdGhhdCBkb2N1bWVudGVkXG4gKiBjb21tdW5pdHkgdGVzdGluZyBjb25maXJtcyByZW5kZXJzIG5vdGljZWFibHkgc29mdGVyIGRldGFpbCB0aGFuIGxhcmdlclxuICogY29tbWVyY2lhbCBtb2RlbHMuIFRoaXMgYXBwbGllcyBhIG1pbGQgdW5zaGFycCBtYXNrIHNwZWNpZmljYWxseSB0b1xuICogR1BVLXNvdXJjZWQgY2xpcHMgKG5ldmVyIHRvIEdlbWluaS9WZW8gb3V0cHV0LCB3aGljaCBkb2Vzbid0IG5lZWQgaXQpLlxuICovXG5cbmFzeW5jIGZ1bmN0aW9uIGZmcHJvYmVDb2RlYyhmaWxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZwcm9iZScsIFtcbiAgICAnLXYnLCAnZXJyb3InLCAnLXNlbGVjdF9zdHJlYW1zJywgJ3Y6MCcsICctc2hvd19lbnRyaWVzJywgJ3N0cmVhbT1jb2RlY19uYW1lJywgJy1vZicsICdjc3Y9cD0wJywgZmlsZSxcbiAgXSk7XG4gIHJldHVybiBzdGRvdXQudHJpbSgpO1xufVxuXG50ZXN0KCdzaGFycGVuR3B1Q2xpcCBwcm9kdWNlcyBhIHZhbGlkLCBkZWNvZGFibGUgb3V0cHV0IGNsaXAnLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGRpciA9IGF3YWl0IGZzLm1rZHRlbXAocGF0aC5qb2luKG9zLnRtcGRpcigpLCAnZ3B1LXNoYXJwZW4tJykpO1xuICB0cnkge1xuICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKGRpciwgJ2luLm1wNCcpO1xuICAgIGNvbnN0IG91dHB1dCA9IHBhdGguam9pbihkaXIsICdvdXQubXA0Jyk7XG4gICAgYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZtcGVnJywgW1xuICAgICAgJy15JywgJy1sb2dsZXZlbCcsICdlcnJvcicsICctZicsICdsYXZmaScsICctaScsICd0ZXN0c3JjPXNpemU9MzIweDI0MDpkdXJhdGlvbj0yJyxcbiAgICAgICctZicsICdsYXZmaScsICctaScsICdzaW5lPWZyZXF1ZW5jeT00NDA6ZHVyYXRpb249MicsXG4gICAgICAnLWM6dicsICdsaWJ4MjY0JywgJy1waXhfZm10JywgJ3l1djQyMHAnLCAnLWM6YScsICdhYWMnLCAnLXNob3J0ZXN0JywgaW5wdXQsXG4gICAgXSk7XG4gICAgYXdhaXQgc2hhcnBlbkdwdUNsaXAoaW5wdXQsIG91dHB1dCk7XG4gICAgY29uc3QgY29kZWMgPSBhd2FpdCBmZnByb2JlQ29kZWMob3V0cHV0KTtcbiAgICBhc3NlcnQuZXF1YWwoY29kZWMsICdoMjY0Jyk7XG4gICAgY29uc3Qgc3RhdCA9IGF3YWl0IGZzLnN0YXQob3V0cHV0KTtcbiAgICBhc3NlcnQub2soc3RhdC5zaXplID4gMCk7XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgZnMucm0oZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gIH1cbn0pO1xuXG50ZXN0KCdzaGFycGVuR3B1Q2xpcCBwcmVzZXJ2ZXMgdGhlIGF1ZGlvIHRyYWNrJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBkaXIgPSBhd2FpdCBmcy5ta2R0ZW1wKHBhdGguam9pbihvcy50bXBkaXIoKSwgJ2dwdS1zaGFycGVuLScpKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBpbnB1dCA9IHBhdGguam9pbihkaXIsICdpbi5tcDQnKTtcbiAgICBjb25zdCBvdXRwdXQgPSBwYXRoLmpvaW4oZGlyLCAnb3V0Lm1wNCcpO1xuICAgIGF3YWl0IGV4ZWNGaWxlQXN5bmMoJ2ZmbXBlZycsIFtcbiAgICAgICcteScsICctbG9nbGV2ZWwnLCAnZXJyb3InLCAnLWYnLCAnbGF2ZmknLCAnLWknLCAndGVzdHNyYz1zaXplPTMyMHgyNDA6ZHVyYXRpb249MicsXG4gICAgICAnLWYnLCAnbGF2ZmknLCAnLWknLCAnc2luZT1mcmVxdWVuY3k9NDQwOmR1cmF0aW9uPTInLFxuICAgICAgJy1jOnYnLCAnbGlieDI2NCcsICctcGl4X2ZtdCcsICd5dXY0MjBwJywgJy1jOmEnLCAnYWFjJywgJy1zaG9ydGVzdCcsIGlucHV0LFxuICAgIF0pO1xuICAgIGF3YWl0IHNoYXJwZW5HcHVDbGlwKGlucHV0LCBvdXRwdXQpO1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZnByb2JlJywgW1xuICAgICAgJy12JywgJ2Vycm9yJywgJy1zZWxlY3Rfc3RyZWFtcycsICdhOjAnLCAnLXNob3dfZW50cmllcycsICdzdHJlYW09Y29kZWNfdHlwZScsICctb2YnLCAnY3N2PXA9MCcsIG91dHB1dCxcbiAgICBdKTtcbiAgICBhc3NlcnQuZXF1YWwoc3Rkb3V0LnRyaW0oKSwgJ2F1ZGlvJyk7XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgZnMucm0oZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gIH1cbn0pO1xuXG50ZXN0KCdzaGFycGVuR3B1Q2xpcCBmYWxscyBiYWNrIHRvIGNvcHlpbmcgdGhlIG9yaWdpbmFsIGNsaXAgaWYgZmZtcGVnIGZhaWxzIG9uIHVucmVhZGFibGUgaW5wdXQnLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGRpciA9IGF3YWl0IGZzLm1rZHRlbXAocGF0aC5qb2luKG9zLnRtcGRpcigpLCAnZ3B1LXNoYXJwZW4tJykpO1xuICB0cnkge1xuICAgIGNvbnN0IGlucHV0ID0gcGF0aC5qb2luKGRpciwgJ2luLm1wNCcpO1xuICAgIGNvbnN0IG91dHB1dCA9IHBhdGguam9pbihkaXIsICdvdXQubXA0Jyk7XG4gICAgYXdhaXQgZnMud3JpdGVGaWxlKGlucHV0LCAnbm90IGEgcmVhbCB2aWRlbyBmaWxlJyk7XG4gICAgLy8gTXVzdCBub3QgdGhyb3cgXHUyMDE0IGEgZmFpbGVkIHNoYXJwZW4gcGFzcyBzaG91bGQgbmV2ZXIgbG9zZSB0aGUgc2NlbmUuXG4gICAgYXdhaXQgc2hhcnBlbkdwdUNsaXAoaW5wdXQsIG91dHB1dCk7XG4gICAgY29uc3Qgb3V0cHV0Q29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKG91dHB1dCwgJ3V0Zi04Jyk7XG4gICAgYXNzZXJ0LmVxdWFsKG91dHB1dENvbnRlbnQsICdub3QgYSByZWFsIHZpZGVvIGZpbGUnKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBmcy5ybShkaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgfVxufSk7XG4iLCAiaW1wb3J0ICogYXMgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBleGVjRmlsZSB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICdub2RlOnV0aWwnO1xuaW1wb3J0IHsgQVNTRVRTX0RJUiwgc2F2ZUltYWdlRmlsZSB9IGZyb20gJy4vY2FwdHVyZS5qcyc7XG5pbXBvcnQgeyBxdWVyeSB9IGZyb20gJy4vcG9vbC5qcyc7XG5pbXBvcnQgeyByZWNvcmRHZW5lcmF0aW9uQ29zdCB9IGZyb20gJy4vY29zdHMuanMnO1xuXG5jb25zdCBleGVjRmlsZUFzeW5jID0gcHJvbWlzaWZ5KGV4ZWNGaWxlKTtcblxudHlwZSBLaW5kID0gJ2ltYWdlJyB8ICd2aWRlbyc7XG5cbmludGVyZmFjZSBHcHVSZXNwb25zZSB7XG4gIGRhdGE/OiBzdHJpbmc7XG4gIHVybD86IHN0cmluZztcbiAgZ3B1U2Vjb25kcz86IG51bWJlcjtcbiAgbW9kZWw/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGVuZHBvaW50KGtpbmQ6IEtpbmQpIHtcbiAgY29uc3QgZGlyZWN0ID0ga2luZCA9PT0gJ2ltYWdlJyA/IHByb2Nlc3MuZW52LkdQVV9JTUFHRV9FTkRQT0lOVCA6IHByb2Nlc3MuZW52LkdQVV9WSURFT19FTkRQT0lOVDtcbiAgY29uc3QgYmFzZSA9IHByb2Nlc3MuZW52LkdQVV9TRVJWRVJfVVJMPy5yZXBsYWNlKC9cXC8kLywgJycpO1xuICByZXR1cm4gZGlyZWN0IHx8IChiYXNlID8gYCR7YmFzZX0vdjEvZ2VuZXJhdGUvJHtraW5kfWAgOiBudWxsKTtcbn1cblxuZnVuY3Rpb24gcnVucG9kRW5kcG9pbnQoa2luZDogS2luZCkge1xuICBjb25zdCBpZCA9IGtpbmQgPT09ICdpbWFnZScgPyBwcm9jZXNzLmVudi5SVU5QT0RfSU1BR0VfRU5EUE9JTlRfSUQgOiBwcm9jZXNzLmVudi5SVU5QT0RfVklERU9fRU5EUE9JTlRfSUQ7XG4gIHJldHVybiBpZCA/IGBodHRwczovL2FwaS5ydW5wb2QuYWkvdjIvJHtpZH1gIDogbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlbGZIb3N0ZWRFbmFibGVkKGtpbmQ6IEtpbmQpIHtcbiAgcmV0dXJuIEJvb2xlYW4oZW5kcG9pbnQoa2luZCkgfHwgcnVucG9kRW5kcG9pbnQoa2luZCkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZWNvcmQoam9iSWQ6IHN0cmluZywga2luZDogS2luZCwgcmVzcG9uc2U6IEdwdVJlc3BvbnNlLCBlbGFwc2VkU2Vjb25kczogbnVtYmVyKSB7XG4gIGNvbnN0IHNlY29uZHMgPSBOdW1iZXIuaXNGaW5pdGUocmVzcG9uc2UuZ3B1U2Vjb25kcykgPyBNYXRoLm1heCgwLCBOdW1iZXIocmVzcG9uc2UuZ3B1U2Vjb25kcykpIDogZWxhcHNlZFNlY29uZHM7XG4gIGNvbnN0IHJhdGUgPSBOdW1iZXIocHJvY2Vzcy5lbnYuR1BVX0NPU1RfUEVSX1NFQ09ORF9VU0QgPz8gMCk7XG4gIGNvbnN0IG1vZGVsID0gcmVzcG9uc2UubW9kZWwgfHwgKGtpbmQgPT09ICdpbWFnZScgPyAnZmx1eDIta2xlaW4tNGInIDogJ3dhbjIuMi10aTJ2LTViJyk7XG4gIGF3YWl0IHF1ZXJ5KGBVUERBVEUgam9icyBTRVQgZ3B1X3NlY29uZHM9Q09BTEVTQ0UoZ3B1X3NlY29uZHMsMCkrJDEsdXBkYXRlZF9hdD1OT1coKSBXSEVSRSBpZD0kMmAsIFtzZWNvbmRzLCBqb2JJZF0pLmNhdGNoKCgpID0+IHt9KTtcbiAgYXdhaXQgcmVjb3JkR2VuZXJhdGlvbkNvc3Qoe1xuICAgIGpvYklkLCBwcm92aWRlcjogJ3NlbGYtaG9zdGVkJywgbW9kZWwsIG9wZXJhdGlvbjogYCR7a2luZH1fZ2VuZXJhdGlvbmAsXG4gICAgcXVhbnRpdHk6IHNlY29uZHMsIHVuaXQ6ICdncHVfc2Vjb25kJywgdW5pdENvc3RVc2Q6IE1hdGgubWF4KDAsIHJhdGUpLFxuICB9KTtcbn1cblxudHlwZSBDYW5jZWxDaGVjayA9ICgpID0+IFByb21pc2U8Ym9vbGVhbj47XG5cbmZ1bmN0aW9uIHJlcXVlc3RUaW1lb3V0TXMoa2luZDogS2luZCkge1xuICBjb25zdCBzcGVjaWZpYyA9IGtpbmQgPT09ICd2aWRlbycgPyBwcm9jZXNzLmVudi5HUFVfVklERU9fUkVRVUVTVF9USU1FT1VUX01TIDogcHJvY2Vzcy5lbnYuR1BVX0lNQUdFX1JFUVVFU1RfVElNRU9VVF9NUztcbiAgY29uc3QgZmFsbGJhY2sgPSBwcm9jZXNzLmVudi5HUFVfUkVRVUVTVF9USU1FT1VUX01TO1xuICBjb25zdCBkZWZhdWx0TXMgPSBraW5kID09PSAndmlkZW8nID8gMTIgKiA2MF8wMDAgOiA1ICogNjBfMDAwO1xuICByZXR1cm4gTWF0aC5tYXgoMzBfMDAwLCBOdW1iZXIoc3BlY2lmaWMgPz8gZmFsbGJhY2sgPz8gZGVmYXVsdE1zKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlcXVlc3Qoa2luZDogS2luZCwgam9iSWQ6IHN0cmluZywgYm9keTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHNob3VsZENhbmNlbD86IENhbmNlbENoZWNrKSB7XG4gIGNvbnN0IHJ1bnBvZCA9IHJ1bnBvZEVuZHBvaW50KGtpbmQpO1xuICBpZiAocnVucG9kKSByZXR1cm4gcmVxdWVzdFJ1bnBvZChydW5wb2QsIGtpbmQsIGpvYklkLCBib2R5LCBzaG91bGRDYW5jZWwpO1xuICBjb25zdCB1cmwgPSBlbmRwb2ludChraW5kKTtcbiAgaWYgKCF1cmwpIHRocm93IG5ldyBFcnJvcihgU2VsZi1ob3N0ZWQgJHtraW5kfSBlbmRwb2ludCBpcyBub3QgY29uZmlndXJlZC5gKTtcbiAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xuICBjb25zdCB0aW1lb3V0TXMgPSByZXF1ZXN0VGltZW91dE1zKGtpbmQpO1xuICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIHRpbWVvdXRNcyk7XG4gIGNvbnN0IGNhbmNlbFdhdGNoID0gc2hvdWxkQ2FuY2VsID8gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIHZvaWQgc2hvdWxkQ2FuY2VsKCkudGhlbigodmFsdWUpID0+IHtcbiAgICAgIGlmICghdmFsdWUgfHwgY2FuY2VsbGVkKSByZXR1cm47XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xuICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH0pLmNhdGNoKCgpID0+IHt9KTtcbiAgfSwgMTUwMCkgOiBudWxsO1xuICBjb25zdCBzdGFydGVkID0gRGF0ZS5ub3coKTtcbiAgY29uc29sZS5pbmZvKGBbZ3B1LSR7a2luZH1dIGpvYj0ke2pvYklkfSBkaXJlY3RfcmVxdWVzdF9zdGFydGVkIHRpbWVvdXRfcz0ke01hdGgucm91bmQodGltZW91dE1zIC8gMTAwMCl9YCk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLCBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAuLi4ocHJvY2Vzcy5lbnYuR1BVX1NFUlZFUl9TRUNSRVQgPyB7IGF1dGhvcml6YXRpb246IGBCZWFyZXIgJHtwcm9jZXNzLmVudi5HUFVfU0VSVkVSX1NFQ1JFVH1gIH0gOiB7fSksXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgfSk7XG4gICAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKGBHUFUgd29ya2VyIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfS5gKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCkgYXMgR3B1UmVzcG9uc2U7XG4gICAgaWYgKCFyZXN1bHQuZGF0YSAmJiAhcmVzdWx0LnVybCkgdGhyb3cgbmV3IEVycm9yKCdHUFUgd29ya2VyIHJldHVybmVkIG5vIGdlbmVyYXRlZCBmaWxlLicpO1xuICAgIGF3YWl0IHJlY29yZChqb2JJZCwga2luZCwgcmVzdWx0LCAoRGF0ZS5ub3coKSAtIHN0YXJ0ZWQpIC8gMTAwMCk7XG4gICAgY29uc29sZS5pbmZvKGBbZ3B1LSR7a2luZH1dIGpvYj0ke2pvYklkfSBkaXJlY3RfcmVxdWVzdF9jb21wbGV0ZWQgZWxhcHNlZD0ke01hdGgucm91bmQoKERhdGUubm93KCkgLSBzdGFydGVkKSAvIDEwMDApfXNgKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChjYW5jZWxsZWQpIHRocm93IG5ldyBFcnJvcihgT3Blbi1zb3VyY2UgJHtraW5kfSBnZW5lcmF0aW9uIHdhcyBjYW5jZWxsZWQgYnkgdGhlIHVzZXIuYCk7XG4gICAgaWYgKChlcnJvciBhcyBFcnJvcikubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB0aHJvdyBuZXcgRXJyb3IoYE9wZW4tc291cmNlICR7a2luZH0gZ2VuZXJhdGlvbiB0aW1lZCBvdXQgYWZ0ZXIgJHtNYXRoLnJvdW5kKHRpbWVvdXRNcyAvIDEwMDApfXMuYCk7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH0gZmluYWxseSB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgIGlmIChjYW5jZWxXYXRjaCkgY2xlYXJJbnRlcnZhbChjYW5jZWxXYXRjaCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVxdWVzdFJ1bnBvZChiYXNlVXJsOiBzdHJpbmcsIGtpbmQ6IEtpbmQsIGpvYklkOiBzdHJpbmcsIGJvZHk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBzaG91bGRDYW5jZWw/OiBDYW5jZWxDaGVjaykge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5SVU5QT0RfQVBJX0tFWTtcbiAgaWYgKCFhcGlLZXkpIHRocm93IG5ldyBFcnJvcignUlVOUE9EX0FQSV9LRVkgaXMgbm90IGNvbmZpZ3VyZWQuJyk7XG4gIGNvbnN0IGhlYWRlcnMgPSB7IGF1dGhvcml6YXRpb246IGBCZWFyZXIgJHthcGlLZXl9YCwgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9O1xuICBjb25zdCBzdGFydGVkID0gRGF0ZS5ub3coKTtcbiAgY29uc3Qgc3VibWl0dGVkID0gYXdhaXQgZmV0Y2goYCR7YmFzZVVybH0vcnVuYCwgeyBtZXRob2Q6ICdQT1NUJywgaGVhZGVycywgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBpbnB1dDogYm9keSB9KSB9KTtcbiAgaWYgKCFzdWJtaXR0ZWQub2spIHRocm93IG5ldyBFcnJvcihgUnVuUG9kIHN1Ym1pc3Npb24gcmV0dXJuZWQgJHtzdWJtaXR0ZWQuc3RhdHVzfS5gKTtcbiAgY29uc3Qgc3VibWlzc2lvbiA9IGF3YWl0IHN1Ym1pdHRlZC5qc29uKCkgYXMgeyBpZD86IHN0cmluZyB9O1xuICBpZiAoIXN1Ym1pc3Npb24uaWQpIHRocm93IG5ldyBFcnJvcignUnVuUG9kIHJldHVybmVkIG5vIGpvYiBJRC4nKTtcbiAgY29uc3QgdGltZW91dE1zID0gcmVxdWVzdFRpbWVvdXRNcyhraW5kKTtcbiAgY29uc3QgdGltZW91dEF0ID0gRGF0ZS5ub3coKSArIHRpbWVvdXRNcztcbiAgbGV0IGxhc3RMb2dBdCA9IDA7XG4gIGNvbnNvbGUuaW5mbyhgW2dwdS0ke2tpbmR9XSBqb2I9JHtqb2JJZH0gcnVucG9kX3N1Ym1pdHRlZCBpZD0ke3N1Ym1pc3Npb24uaWR9IHRpbWVvdXRfcz0ke01hdGgucm91bmQodGltZW91dE1zIC8gMTAwMCl9YCk7XG4gIHdoaWxlIChEYXRlLm5vdygpIDwgdGltZW91dEF0KSB7XG4gICAgaWYgKHNob3VsZENhbmNlbCAmJiBhd2FpdCBzaG91bGRDYW5jZWwoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPcGVuLXNvdXJjZSAke2tpbmR9IGdlbmVyYXRpb24gd2FzIGNhbmNlbGxlZCBieSB0aGUgdXNlci5gKTtcbiAgICB9XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBpZiAobm93IC0gbGFzdExvZ0F0ID49IDMwXzAwMCkge1xuICAgICAgbGFzdExvZ0F0ID0gbm93O1xuICAgICAgY29uc29sZS5pbmZvKGBbZ3B1LSR7a2luZH1dIGpvYj0ke2pvYklkfSBydW5wb2Rfd2FpdGluZyBpZD0ke3N1Ym1pc3Npb24uaWR9IGVsYXBzZWQ9JHtNYXRoLnJvdW5kKChub3cgLSBzdGFydGVkKSAvIDEwMDApfXNgKTtcbiAgICB9XG4gICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMzAwMCkpO1xuICAgIGNvbnN0IHN0YXR1c1Jlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YmFzZVVybH0vc3RhdHVzLyR7c3VibWlzc2lvbi5pZH1gLCB7IGhlYWRlcnMgfSk7XG4gICAgaWYgKCFzdGF0dXNSZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKGBSdW5Qb2Qgc3RhdHVzIHJldHVybmVkICR7c3RhdHVzUmVzcG9uc2Uuc3RhdHVzfS5gKTtcbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBzdGF0dXNSZXNwb25zZS5qc29uKCkgYXMgeyBzdGF0dXM/OiBzdHJpbmc7IG91dHB1dD86IEdwdVJlc3BvbnNlOyBlcnJvcj86IHN0cmluZzsgZXhlY3V0aW9uVGltZT86IG51bWJlciB9O1xuICAgIGlmIChzdGF0dXMuc3RhdHVzID09PSAnQ09NUExFVEVEJyAmJiBzdGF0dXMub3V0cHV0KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7IC4uLnN0YXR1cy5vdXRwdXQsIGdwdVNlY29uZHM6IHN0YXR1cy5vdXRwdXQuZ3B1U2Vjb25kcyA/PyAoc3RhdHVzLmV4ZWN1dGlvblRpbWUgPyBzdGF0dXMuZXhlY3V0aW9uVGltZSAvIDEwMDAgOiB1bmRlZmluZWQpIH07XG4gICAgICBpZiAoIXJlc3VsdC5kYXRhICYmICFyZXN1bHQudXJsKSB0aHJvdyBuZXcgRXJyb3IoJ1J1blBvZCB3b3JrZXIgcmV0dXJuZWQgbm8gZ2VuZXJhdGVkIGZpbGUuJyk7XG4gICAgICBhd2FpdCByZWNvcmQoam9iSWQsIGtpbmQsIHJlc3VsdCwgKERhdGUubm93KCkgLSBzdGFydGVkKSAvIDEwMDApO1xuICAgICAgY29uc29sZS5pbmZvKGBbZ3B1LSR7a2luZH1dIGpvYj0ke2pvYklkfSBydW5wb2RfY29tcGxldGVkIGlkPSR7c3VibWlzc2lvbi5pZH0gZWxhcHNlZD0ke01hdGgucm91bmQoKERhdGUubm93KCkgLSBzdGFydGVkKSAvIDEwMDApfXNgKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGlmIChzdGF0dXMuc3RhdHVzID09PSAnRkFJTEVEJyB8fCBzdGF0dXMuc3RhdHVzID09PSAnQ0FOQ0VMTEVEJyB8fCBzdGF0dXMuc3RhdHVzID09PSAnVElNRURfT1VUJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHN0YXR1cy5lcnJvciB8fCBgUnVuUG9kIGpvYiAke3N0YXR1cy5zdGF0dXMudG9Mb3dlckNhc2UoKX0uYCk7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgUnVuUG9kICR7a2luZH0gZ2VuZXJhdGlvbiB0aW1lZCBvdXQgYWZ0ZXIgJHtNYXRoLnJvdW5kKHRpbWVvdXRNcyAvIDEwMDApfXMuYCk7XG59XG5cbmZ1bmN0aW9uIGVuY29kZWRSZWZlcmVuY2VzKHJlZmVyZW5jZXM6IEJ1ZmZlcltdLCBsaW1pdDogbnVtYmVyKSB7XG4gIGNvbnN0IHNlbGVjdGVkOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgYnl0ZXMgPSAwO1xuICBmb3IgKGNvbnN0IGltYWdlIG9mIHJlZmVyZW5jZXMuc2xpY2UoMCwgbGltaXQpKSB7XG4gICAgaWYgKGJ5dGVzICsgaW1hZ2UubGVuZ3RoID4gNyAqIDEwMjQgKiAxMDI0KSBjb250aW51ZTtcbiAgICBzZWxlY3RlZC5wdXNoKGltYWdlLnRvU3RyaW5nKCdiYXNlNjQnKSk7XG4gICAgYnl0ZXMgKz0gaW1hZ2UubGVuZ3RoO1xuICB9XG4gIHJldHVybiBzZWxlY3RlZDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnl0ZXMocmVzdWx0OiBHcHVSZXNwb25zZSkge1xuICBpZiAocmVzdWx0LmRhdGEpIHJldHVybiBCdWZmZXIuZnJvbShyZXN1bHQuZGF0YSwgJ2Jhc2U2NCcpO1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHJlc3VsdC51cmwhKTtcbiAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZG93bmxvYWQgdGhlIGdlbmVyYXRlZCBHUFUgZmlsZS4nKTtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGF3YWl0IHJlc3BvbnNlLmFycmF5QnVmZmVyKCkpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVHcHVJbWFnZShqb2JJZDogc3RyaW5nLCBzY2VuZUluZGV4OiBudW1iZXIsIHByb21wdDogc3RyaW5nLCByZWZlcmVuY2VzOiBCdWZmZXJbXSwgYXNwZWN0UmF0aW86IHN0cmluZywgcXVhbGl0eTogc3RyaW5nKSB7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlcXVlc3QoJ2ltYWdlJywgam9iSWQsIHtcbiAgICBtb2RlbDogcHJvY2Vzcy5lbnYuR1BVX0lNQUdFX01PREVMID8/ICdmbHV4Mi1rbGVpbi00YicsIHByb21wdCwgYXNwZWN0UmF0aW8sIHF1YWxpdHksXG4gICAgcmVmZXJlbmNlczogZW5jb2RlZFJlZmVyZW5jZXMocmVmZXJlbmNlcywgNCksXG4gIH0pO1xuICByZXR1cm4gc2F2ZUltYWdlRmlsZShqb2JJZCwgYHBob3RvLSR7c2NlbmVJbmRleH0tJHtxdWFsaXR5fS5wbmdgLCBhd2FpdCBieXRlcyhyZXN1bHQpKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlR3B1VmlkZW8oam9iSWQ6IHN0cmluZywgc2NlbmVJbmRleDogbnVtYmVyLCBwcm9tcHQ6IHN0cmluZywgcmVmZXJlbmNlczogQnVmZmVyW10sIGFzcGVjdFJhdGlvOiBzdHJpbmcsIHNob3VsZENhbmNlbD86IENhbmNlbENoZWNrKSB7XG4gIC8vIFRoZSBzZWxmLWhvc3RlZCB3b3JrZXIgcnVucyB3YW4yLjItdGkydi01YiBieSBkZWZhdWx0IFx1MjAxNCBhIHNtYWxsICg1QlxuICAvLyBwYXJhbWV0ZXIpIG9wZW4gdmlkZW8gbW9kZWwuIFR3byBjb25jcmV0ZSwgZXZpZGVuY2UtYmFzZWQgaW1wcm92ZW1lbnRzXG4gIC8vIG92ZXIgdGhlIHByZXZpb3VzIHJlcXVlc3QgKHdoaWNoIHNlbnQgbm90aGluZyBidXQgcHJvbXB0L2FzcGVjdFJhdGlvKTpcbiAgLy8gICAxLiBuZWdhdGl2ZVByb21wdDogV0FOMi4yIGV4cGxpY2l0bHkgc3VwcG9ydHMgbmVnYXRpdmUgcHJvbXB0aW5nIGZvclxuICAvLyAgICAgIGNsZWFudXAgb2YgZXhhY3RseSB0aGUgYXJ0aWZhY3RzIHRoaXMgbW9kZWwgaXMgcHJvbmUgdG8gKGJsdXIsXG4gIC8vICAgICAgZmxpY2tlciwgd2FycGVkIGRldGFpbCwgZXh0cmEvZGlzdG9ydGVkIGxpbWJzKS4gQWRkZWQgYXMgYSBiZXN0LVxuICAvLyAgICAgIGVmZm9ydCBvcHRpb25hbCBmaWVsZCBcdTIwMTQgaWYgdGhlIGRlcGxveWVkIHdvcmtlciBkb2Vzbid0IHJlY29nbml6ZVxuICAvLyAgICAgIGl0LCBpdCdzIHNpbXBseSBleHRyYSBKU09OIHRoZSB3b3JrZXIgaWdub3Jlczsgbm90aGluZyBicmVha3MuXG4gIC8vICAgMi4gVGhlIHByb21wdCBpdHNlbGYgYWxyZWFkeSBjYXJyaWVzIGZ1bGwgY2luZW1hdGljIGRldGFpbCBmcm9tIHRoZVxuICAvLyAgICAgIHNoYXJlZCBtYXN0ZXIgcHJvbXB0ICh2ZXJpZmllZCBhZ2FpbnN0IGN1cnJlbnQgV0FOMi4yIHByb21wdGluZ1xuICAvLyAgICAgIGd1aWRlczogaXQgd2FudHMgYSBzdHJ1Y3R1cmVkIDgwLTEyMCB3b3JkIHByb21wdCwgbm90IGEgc2hvcnRlbmVkXG4gIC8vICAgICAgb25lIFx1MjAxNCB1bmRlci1zcGVjaWZ5aW5nIG1ha2VzIGl0IGRlZmF1bHQgdG8gXCJyYW5kb20gY2luZW1hdGljXCJcbiAgLy8gICAgICBjaG9pY2VzKSBzbyBubyBzaW1wbGlmaWNhdGlvbiBpcyBhcHBsaWVkLCBvbmx5IHRoZSBuZWdhdGl2ZVxuICAvLyAgICAgIGFkZGl0aW9uIGFib3ZlLlxuICBjb25zdCBuZWdhdGl2ZVByb21wdCA9ICdibHVycnksIHNvZnQgZm9jdXMsIGZsaWNrZXJpbmcsIHVuc3RhYmxlIG1vdGlvbiwgd2FycGVkIHRleHQsIGdhcmJsZWQgdGV4dCwgZGlzdG9ydGVkIGxvZ28sIGV4dHJhIGxpbWJzLCBkZWZvcm1lZCBoYW5kcywgbG93IGRldGFpbCwgbG93IHF1YWxpdHksIGFydGlmYWN0cywgd2F0ZXJtYXJrJztcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVxdWVzdCgndmlkZW8nLCBqb2JJZCwge1xuICAgIG1vZGVsOiBwcm9jZXNzLmVudi5HUFVfVklERU9fTU9ERUwgPz8gJ3dhbjIuMi10aTJ2LTViJywgcHJvbXB0LCBuZWdhdGl2ZVByb21wdCwgYXNwZWN0UmF0aW8sXG4gICAgZHVyYXRpb25TZWNvbmRzOiA4LCByZWZlcmVuY2VzOiBlbmNvZGVkUmVmZXJlbmNlcyhyZWZlcmVuY2VzLCAzKSxcbiAgfSwgc2hvdWxkQ2FuY2VsKTtcbiAgY29uc3QgZGlyID0gcGF0aC5qb2luKEFTU0VUU19ESVIsIGpvYklkKTtcbiAgYXdhaXQgZnMubWtkaXIoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgY29uc3QgcmF3ID0gcGF0aC5qb2luKGRpciwgYGdwdS0ke3NjZW5lSW5kZXh9LXJhdy5tcDRgKTtcbiAgYXdhaXQgZnMud3JpdGVGaWxlKHJhdywgYXdhaXQgYnl0ZXMocmVzdWx0KSk7XG4gIGNvbnN0IG91dHB1dCA9IHBhdGguam9pbihkaXIsIGBncHUtJHtzY2VuZUluZGV4fS5tcDRgKTtcbiAgYXdhaXQgc2hhcnBlbkdwdUNsaXAocmF3LCBvdXRwdXQpO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG4vKipcbiAqIFNtYWxsICg1Qi1wYXJhbWV0ZXIpIG9wZW4gdmlkZW8gbW9kZWxzIGxpa2Ugd2FuMi4yLXRpMnYtNWIgY29tbW9ubHkgcmVuZGVyXG4gKiBub3RpY2VhYmx5IHNvZnRlci9ibHVycmllciBkZXRhaWwgdGhhbiBsYXJnZXIgY29tbWVyY2lhbCBtb2RlbHMgKFZlbykgXHUyMDE0XG4gKiB0aGlzIGlzIGEga25vd24sIGRvY3VtZW50ZWQgY2hhcmFjdGVyaXN0aWMsIG5vdCBhIGJ1ZyBpbiB0aGlzIGFwcCdzXG4gKiByZXF1ZXN0LiBBIG1pbGQgdW5zaGFycCBtYXNrIG1lYW5pbmdmdWxseSBpbXByb3ZlcyBwZXJjZWl2ZWQgc2hhcnBuZXNzXG4gKiB3aXRob3V0IGludHJvZHVjaW5nIGhhbG8gYXJ0aWZhY3RzIG9yIG90aGVyd2lzZSBhbHRlcmluZyBjb250ZW50LCBhbmQgaXNcbiAqIGFwcGxpZWQgb25seSB0byBHUFUtc291cmNlZCBjbGlwcyBcdTIwMTQgR2VtaW5pL1ZlbyBvdXRwdXQgYWxyZWFkeSBoYXMgZW5vdWdoXG4gKiBpbmhlcmVudCBkZXRhaWwgdGhhdCB0aGlzIHdvdWxkIG9ubHkgbG9vayBhcnRpZmljaWFsIHRoZXJlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2hhcnBlbkdwdUNsaXAoaW5wdXQ6IHN0cmluZywgb3V0cHV0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZm1wZWcnLCBbXG4gICAgICAnLXknLCAnLWhpZGVfYmFubmVyJywgJy1sb2dsZXZlbCcsICdlcnJvcicsICctaScsIGlucHV0LFxuICAgICAgJy12ZicsICd1bnNoYXJwPTU6NTowLjY6NTo1OjAuMCcsXG4gICAgICAnLWM6dicsICdsaWJ4MjY0JywgJy1wcmVzZXQnLCAnZmFzdCcsICctY3JmJywgJzE4JywgJy1waXhfZm10JywgJ3l1djQyMHAnLFxuICAgICAgJy1jOmEnLCAnY29weScsXG4gICAgICBvdXRwdXQsXG4gICAgXSwgeyB0aW1lb3V0OiA1ICogNjBfMDAwLCBtYXhCdWZmZXI6IDggKiAxMDI0ICogMTAyNCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBJZiBzaGFycGVuaW5nIGZhaWxzIGZvciBhbnkgcmVhc29uICh1bmV4cGVjdGVkIGNvZGVjLCBjb3JydXB0IGlucHV0KSxcbiAgICAvLyBmYWxsIGJhY2sgdG8gdGhlIG9yaWdpbmFsIGNsaXAgdW50b3VjaGVkIHJhdGhlciB0aGFuIGxvc2luZyB0aGUgc2NlbmUuXG4gICAgY29uc29sZS53YXJuKGBbZ3B1LXZpZGVvXSBzaGFycGVuaW5nIGZhaWxlZCwgdXNpbmcgb3JpZ2luYWwgY2xpcDogJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG4gICAgYXdhaXQgZnMuY29weUZpbGUoaW5wdXQsIG91dHB1dCk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBjaHJvbWl1bSwgdHlwZSBQYWdlLCB0eXBlIEJyb3dzZXIgfSBmcm9tICdwbGF5d3JpZ2h0JztcbmltcG9ydCB7IGV4ZWNGaWxlIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ25vZGU6dXRpbCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHZhbGlkYXRlVXJsIH0gZnJvbSAnLi9zc3JmLmpzJztcblxuY29uc3QgZXhlY0ZpbGVBc3luYyA9IHByb21pc2lmeShleGVjRmlsZSk7XG5cbmV4cG9ydCBjb25zdCBBU1NFVFNfRElSID0gcHJvY2Vzcy5lbnYuQVNTRVRTX0RJUiA/PyAnL3RtcC9haXdlYnZpZGVvLWFzc2V0cyc7XG5jb25zdCBWSUVXUE9SVCA9IHsgd2lkdGg6IDE0NDAsIGhlaWdodDogOTAwIH07XG5jb25zdCBNT0JJTEVfVklFV1BPUlQgPSB7IHdpZHRoOiA0MzAsIGhlaWdodDogOTMyIH07XG5jb25zdCBNQVhfUEFHRVMgPSBNYXRoLm1pbigyMCwgTWF0aC5tYXgoMSwgTnVtYmVyKHByb2Nlc3MuZW52LkNBUFRVUkVfTUFYX1BBR0VTID8/IDgpKSk7XG5jb25zdCBTRVRUTEVfTVMgPSBNYXRoLm1heCgzMDAsIE1hdGgubWluKDMwMDAsIE51bWJlcihwcm9jZXNzLmVudi5DQVBUVVJFX1NFVFRMRV9NUyA/PyA5MDApKSk7XG5jb25zdCBDQVBUVVJFX0NPTkNVUlJFTkNZID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oMywgTnVtYmVyKHByb2Nlc3MuZW52LkNBUFRVUkVfQ09OQ1VSUkVOQ1kgPz8gMSkpKTtcbi8vIFRoaXMgaXMgYSBzb2Z0IGJ1ZGdldCwgbm90IGEgYnJvd3Nlci1raWxsaW5nIHRpbWVyLiBBIHNsb3cgb3B0aW9uYWwgcGFnZSBpc1xuLy8gc2tpcHBlZCB3aGVuIHRoZSBidWRnZXQgaXMgbmVhcmx5IGV4aGF1c3RlZCwgd2hpbGUgYSBzdWNjZXNzZnVsIGhvbWVwYWdlXG4vLyBjYXB0dXJlIGlzIHN0aWxsIHJldHVybmVkIGluc3RlYWQgb2YgYmVpbmcgZGVzdHJveWVkIGJ5IGEgZ2xvYmFsIHRpbWVvdXQuXG5jb25zdCBDQVBUVVJFX0JVREdFVF9NUyA9IE1hdGgubWF4KDE4MF8wMDAsIE51bWJlcihwcm9jZXNzLmVudi5DQVBUVVJFX1RJTUVPVVRfTVMgPz8gNjAwXzAwMCkpO1xuY29uc3QgQ0hJTERfUEFHRV9CVURHRVRfTVMgPSBNYXRoLm1heCgxOF8wMDAsIE1hdGgubWluKDc1XzAwMCwgTnVtYmVyKHByb2Nlc3MuZW52LkNBUFRVUkVfQ0hJTERfVElNRU9VVF9NUyA/PyA0Ml8wMDApKSk7XG5sZXQgYWN0aXZlQ2FwdHVyZXMgPSAwO1xuY29uc3QgY2FwdHVyZVdhaXRlcnM6IEFycmF5PCgpID0+IHZvaWQ+ID0gW107XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FwdHVyZWRQYWdlIHtcbiAgdXJsOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHNjcmVlbnNob3RVcmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTaXRlQ2FwdHVyZSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCBudWxsO1xuICBsb2dvVXJsOiBzdHJpbmcgfCBudWxsO1xuICBicmFuZENvbG9yczogc3RyaW5nW107XG4gIGh0bWxMYW5nOiBzdHJpbmcgfCBudWxsO1xuICBzY3JlZW5zaG90VXJsOiBzdHJpbmc7XG4gIGZ1bGxQYWdlU2NyZWVuc2hvdFVybDogc3RyaW5nO1xuICBtb2JpbGVTY3JlZW5zaG90VXJsOiBzdHJpbmcgfCBudWxsO1xuICBtb2JpbGVGdWxsUGFnZVNjcmVlbnNob3RVcmw6IHN0cmluZyB8IG51bGw7XG4gIHJlY29yZGluZ1VybDogc3RyaW5nIHwgbnVsbDtcbiAgcGFnZXM6IENhcHR1cmVkUGFnZVtdO1xuICBwYWdlQ291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgQ2FwdHVyZVByb2dyZXNzID0gKHByb2dyZXNzOiBudW1iZXIsIG1lc3NhZ2U6IHN0cmluZywgZXRhU2Vjb25kczogbnVtYmVyKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlRGlyKGRpcjogc3RyaW5nKSB7XG4gIGF3YWl0IGZzLm1rZGlyKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFjcXVpcmVDYXB0dXJlU2xvdCgpIHtcbiAgaWYgKGFjdGl2ZUNhcHR1cmVzIDwgQ0FQVFVSRV9DT05DVVJSRU5DWSkge1xuICAgIGFjdGl2ZUNhcHR1cmVzKys7XG4gICAgcmV0dXJuO1xuICB9XG4gIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiBjYXB0dXJlV2FpdGVycy5wdXNoKHJlc29sdmUpKTtcbiAgYWN0aXZlQ2FwdHVyZXMrKztcbn1cblxuZnVuY3Rpb24gcmVsZWFzZUNhcHR1cmVTbG90KCkge1xuICBhY3RpdmVDYXB0dXJlcyA9IE1hdGgubWF4KDAsIGFjdGl2ZUNhcHR1cmVzIC0gMSk7XG4gIGNhcHR1cmVXYWl0ZXJzLnNoaWZ0KCk/LigpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBndWFyZE5hdmlnYXRpb24ocm91dGU6IGltcG9ydCgncGxheXdyaWdodCcpLlJvdXRlKSB7XG4gIGNvbnN0IHJlcXVlc3QgPSByb3V0ZS5yZXF1ZXN0KCk7XG4gIGlmICghcmVxdWVzdC5pc05hdmlnYXRpb25SZXF1ZXN0KCkpIHJldHVybiByb3V0ZS5jb250aW51ZSgpO1xuICB0cnkge1xuICAgIGF3YWl0IHZhbGlkYXRlVXJsKHJlcXVlc3QudXJsKCkpO1xuICAgIGF3YWl0IHJvdXRlLmNvbnRpbnVlKCk7XG4gIH0gY2F0Y2gge1xuICAgIGF3YWl0IHJvdXRlLmFib3J0KCdibG9ja2VkYnljbGllbnQnKTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZUltYWdlRmlsZShqb2JJZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGRhdGE6IEJ1ZmZlcik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGRpciA9IHBhdGguam9pbihBU1NFVFNfRElSLCBqb2JJZCk7XG4gIGF3YWl0IGVuc3VyZURpcihkaXIpO1xuICBhd2FpdCBmcy53cml0ZUZpbGUocGF0aC5qb2luKGRpciwgbmFtZSksIGRhdGEpO1xuICByZXR1cm4gYC9hcGkvYXNzZXRzLyR7am9iSWR9LyR7bmFtZX1gO1xufVxuXG5hc3luYyBmdW5jdGlvbiB3aXRoVGltZW91dDxUPihwcm9taXNlOiBQcm9taXNlPFQ+LCB0aW1lb3V0TXM6IG51bWJlciwgbGFiZWw6IHN0cmluZyk6IFByb21pc2U8VD4ge1xuICBsZXQgdGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IFByb21pc2UucmFjZShbXG4gICAgICBwcm9taXNlLFxuICAgICAgbmV3IFByb21pc2U8VD4oKF8sIHJlamVjdCkgPT4ge1xuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KG5ldyBFcnJvcihgJHtsYWJlbH1fVElNRU9VVGApKSwgdGltZW91dE1zKTtcbiAgICAgIH0pLFxuICAgIF0pO1xuICB9IGZpbmFsbHkge1xuICAgIGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb25maWd1cmVQYWdlKHBhZ2U6IFBhZ2UpIHtcbiAgcGFnZS5zZXREZWZhdWx0VGltZW91dCgxNV8wMDApO1xuICBwYWdlLnNldERlZmF1bHROYXZpZ2F0aW9uVGltZW91dCg0MF8wMDApO1xufVxuXG4vKipcbiAqIEh5ZHJhdGUgbGF6eSBtZWRpYSB3aXRob3V0IGxldHRpbmcgb25lIHBhZ2UgbW9ub3BvbGl6ZSB0aGUgd2hvbGUgY2FwdHVyZS5cbiAqIFRoZSBob21lcGFnZSBnZXRzIGEgZGVlcGVyIHBhc3M7IGNoaWxkIHBhZ2VzIGdldCBhIHF1aWNrZXIgc2luZ2xlIHBhc3MuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JSZWFkeShwYWdlOiBQYWdlLCBkZWVwID0gZmFsc2UpIHtcbiAgYXdhaXQgcGFnZS53YWl0Rm9yTG9hZFN0YXRlKCdkb21jb250ZW50bG9hZGVkJywgeyB0aW1lb3V0OiA0MF8wMDAgfSk7XG4gIGF3YWl0IHBhZ2Uud2FpdEZvckxvYWRTdGF0ZSgnbmV0d29ya2lkbGUnLCB7IHRpbWVvdXQ6IGRlZXAgPyAxMF8wMDAgOiA1XzAwMCB9KS5jYXRjaCgoKSA9PiB7fSk7XG5cbiAgYXdhaXQgd2l0aFRpbWVvdXQocGFnZS5ldmFsdWF0ZShhc3luYyAoeyBwYXNzZXMsIG1heFN0ZXBzLCBzdGVwRGVsYXkgfSkgPT4ge1xuICAgIGNvbnN0IHNsZWVwID0gKG1zOiBudW1iZXIpID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgY29uc3QgaHlkcmF0ZSA9ICgpID0+IHtcbiAgICAgIGZvciAoY29uc3QgaW1nIG9mIEFycmF5LmZyb20oZG9jdW1lbnQuaW1hZ2VzKS5zbGljZSgwLCA1MDApKSB7XG4gICAgICAgIGltZy5sb2FkaW5nID0gJ2VhZ2VyJztcbiAgICAgICAgY29uc3Qgc291cmNlID0gaW1nLmRhdGFzZXQuc3JjIHx8IGltZy5kYXRhc2V0LmxhenlTcmMgfHwgaW1nLmRhdGFzZXQub3JpZ2luYWwgfHwgaW1nLmdldEF0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbC1zcmMnKSB8fCBpbWcuZ2V0QXR0cmlidXRlKCdkYXRhLWxhenknKSB8fCBpbWcuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xuICAgICAgICBjb25zdCBzb3VyY2VTZXQgPSBpbWcuZGF0YXNldC5zcmNzZXQgfHwgaW1nLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmNzZXQnKTtcbiAgICAgICAgaWYgKHNvdXJjZSAmJiBpbWcuc3JjICE9PSBzb3VyY2UpIGltZy5zcmMgPSBzb3VyY2U7XG4gICAgICAgIGlmIChzb3VyY2VTZXQgJiYgaW1nLnNyY3NldCAhPT0gc291cmNlU2V0KSBpbWcuc3Jjc2V0ID0gc291cmNlU2V0O1xuICAgICAgICBpbWcuZGVjb2RlPy4oKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3BpY3R1cmUgc291cmNlLCB2aWRlbyBzb3VyY2UnKSkpIHtcbiAgICAgICAgY29uc3QgbGF6eVNyYyA9IHNvdXJjZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG4gICAgICAgIGNvbnN0IGxhenlTZXQgPSBzb3VyY2UuZ2V0QXR0cmlidXRlKCdkYXRhLXNyY3NldCcpO1xuICAgICAgICBpZiAobGF6eVNyYykgc291cmNlLnNldEF0dHJpYnV0ZSgnc3JjJywgbGF6eVNyYyk7XG4gICAgICAgIGlmIChsYXp5U2V0KSBzb3VyY2Uuc2V0QXR0cmlidXRlKCdzcmNzZXQnLCBsYXp5U2V0KTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KCdbZGF0YS1iZ10sIFtkYXRhLWJhY2tncm91bmQtaW1hZ2VdLCBbZGF0YS1sYXp5LWJhY2tncm91bmRdJykpLnNsaWNlKDAsIDI1MCkpIHtcbiAgICAgICAgY29uc3QgYmFja2dyb3VuZCA9IGVsZW1lbnQuZGF0YXNldC5iZyB8fCBlbGVtZW50LmRhdGFzZXQuYmFja2dyb3VuZEltYWdlIHx8IGVsZW1lbnQuZGF0YXNldC5sYXp5QmFja2dyb3VuZDtcbiAgICAgICAgaWYgKGJhY2tncm91bmQpIGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYmFja2dyb3VuZC5zdGFydHNXaXRoKCd1cmwoJykgPyBiYWNrZ3JvdW5kIDogYHVybChcIiR7YmFja2dyb3VuZH1cIilgO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB2aWRlbyBvZiBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ZpZGVvJykpLnNsaWNlKDAsIDMwKSkge1xuICAgICAgICB2aWRlby5wcmVsb2FkID0gJ21ldGFkYXRhJztcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuICAgICAgICB2aWRlby5sb2FkKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGh5ZHJhdGUoKTtcbiAgICBmb3IgKGxldCBwYXNzID0gMDsgcGFzcyA8IHBhc3NlczsgcGFzcysrKSB7XG4gICAgICBjb25zdCBoZWlnaHQgPSBNYXRoLm1heChkb2N1bWVudC5ib2R5LnNjcm9sbEhlaWdodCwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbEhlaWdodCk7XG4gICAgICBjb25zdCBtYXhZID0gTWF0aC5tYXgoMCwgaGVpZ2h0IC0gaW5uZXJIZWlnaHQpO1xuICAgICAgY29uc3Qgc3RlcENvdW50ID0gTWF0aC5tYXgoMSwgTWF0aC5taW4obWF4U3RlcHMsIE1hdGguY2VpbChtYXhZIC8gTWF0aC5tYXgoNTAwLCBpbm5lckhlaWdodCAqIDAuODUpKSkpO1xuICAgICAgZm9yIChsZXQgc3RlcCA9IDA7IHN0ZXAgPD0gc3RlcENvdW50OyBzdGVwKyspIHtcbiAgICAgICAgY29uc3QgeSA9IHN0ZXBDb3VudCA9PT0gMCA/IDAgOiBNYXRoLnJvdW5kKChtYXhZICogc3RlcCkgLyBzdGVwQ291bnQpO1xuICAgICAgICB3aW5kb3cuc2Nyb2xsVG8oMCwgeSk7XG4gICAgICAgIGh5ZHJhdGUoKTtcbiAgICAgICAgYXdhaXQgc2xlZXAoc3RlcERlbGF5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgd2luZG93LnNjcm9sbFRvKDAsIDApO1xuICAgIGh5ZHJhdGUoKTtcbiAgICBhd2FpdCBzbGVlcCgzNTApO1xuICB9LCB7IHBhc3NlczogZGVlcCA/IDIgOiAxLCBtYXhTdGVwczogZGVlcCA/IDE2IDogMTAsIHN0ZXBEZWxheTogZGVlcCA/IDE0MCA6IDEwMCB9KSwgZGVlcCA/IDE0XzAwMCA6IDdfMDAwLCAnSFlEUkFURScpLmNhdGNoKCgpID0+IHt9KTtcblxuICBhd2FpdCBwYWdlLndhaXRGb3JMb2FkU3RhdGUoJ25ldHdvcmtpZGxlJywgeyB0aW1lb3V0OiBkZWVwID8gN18wMDAgOiAzXzAwMCB9KS5jYXRjaCgoKSA9PiB7fSk7XG4gIGF3YWl0IHdpdGhUaW1lb3V0KHBhZ2UuZXZhbHVhdGUoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGZvbnRzID0gKGRvY3VtZW50IGFzIERvY3VtZW50ICYgeyBmb250cz86IEZvbnRGYWNlU2V0IH0pLmZvbnRzO1xuICAgIGlmIChmb250cykgYXdhaXQgZm9udHMucmVhZHkuY2F0Y2goKCkgPT4ge30pO1xuICAgIGNvbnN0IGltYWdlcyA9IEFycmF5LmZyb20oZG9jdW1lbnQuaW1hZ2VzKS5zbGljZSgwLCAyNTApO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKGltYWdlcy5tYXAoKGltZykgPT4gaW1nLmNvbXBsZXRlID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgY29uc3QgZG9uZSA9ICgpID0+IHJlc29sdmUoKTtcbiAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZG9uZSwgeyBvbmNlOiB0cnVlIH0pO1xuICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZG9uZSwgeyBvbmNlOiB0cnVlIH0pO1xuICAgICAgc2V0VGltZW91dChkb25lLCAyNTAwKTtcbiAgICB9KSkpO1xuICB9KSwgZGVlcCA/IDdfMDAwIDogNF8wMDAsICdNRURJQScpLmNhdGNoKCgpID0+IHt9KTtcbiAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dChTRVRUTEVfTVMpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjb2xsZWN0TWV0YWRhdGEocGFnZTogUGFnZSwgZmFsbGJhY2tVcmw6IHN0cmluZykge1xuICByZXR1cm4gcGFnZS5ldmFsdWF0ZSgodXJsKSA9PiB7XG4gICAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC50aXRsZS50cmltKCkgfHwgbmV3IFVSTCh1cmwpLmhvc3RuYW1lO1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MTWV0YUVsZW1lbnQ+KCdtZXRhW25hbWU9XCJkZXNjcmlwdGlvblwiXScpPy5jb250ZW50Py50cmltKCkgfHwgbnVsbDtcbiAgICBjb25zdCBpY29uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MTGlua0VsZW1lbnQ+KCdsaW5rW3JlbCo9XCJpY29uXCJdJyk/LmhyZWYgfHwgbnVsbDtcbiAgICBjb25zdCBsb2dvID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MSW1hZ2VFbGVtZW50PignaGVhZGVyIGltZywgbmF2IGltZywgaW1nW2FsdCo9XCJsb2dvXCIgaV0nKT8uc3JjIHx8IGljb247XG4gICAgY29uc3QgaHRtbExhbmcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZz8udHJpbSgpIHx8IG51bGw7XG4gICAgY29uc3QgY29sb3JzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYWRkID0gKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IG1hdGNoID0gdmFsdWUubWF0Y2goLyNbMC05YS1mXXs2fVxcYi9pZyk7XG4gICAgICBtYXRjaD8uZm9yRWFjaCgoY29sb3IpID0+IGNvbG9ycy5zaXplIDwgNiAmJiBjb2xvcnMuYWRkKGNvbG9yLnRvTG93ZXJDYXNlKCkpKTtcbiAgICB9O1xuICAgIGFkZChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuaW5uZXJIVE1MLnNsaWNlKDAsIDUwMF8wMDApKTtcbiAgICByZXR1cm4geyB0aXRsZSwgZGVzY3JpcHRpb24sIGljb25Vcmw6IGljb24sIGxvZ29Vcmw6IGxvZ28sIGJyYW5kQ29sb3JzOiBBcnJheS5mcm9tKGNvbG9ycyksIGh0bWxMYW5nIH07XG4gIH0sIGZhbGxiYWNrVXJsKTtcbn1cblxuLyoqXG4gKiBQcmVzZXJ2ZSBhIGNsZWFuIGxvY2FsIGNvcHkgb2YgdGhlIHNpdGUncyBvd24gaWNvbi9sb2dvLiBUaGUgc291cmNlIFVSTCBpc1xuICogdmFsaWRhdGVkIGJlZm9yZSBpdCBpcyBsb2FkZWQgaW50byBhIHRlbXBvcmFyeSBzcXVhcmUgY2FyZCwgYW5kIFBsYXl3cmlnaHRcbiAqIHJhc3Rlcml6ZXMgU1ZHL0lDTy9QTkcgaW5wdXRzIHRvIG9uZSBkZXBlbmRhYmxlIEpQRUcgcmVmZXJlbmNlIGZvciBsYXRlclxuICogaWNvbiBnZW5lcmF0aW9uIGFuZCBicmFuZGVkIHZpZGVvIGVuZGluZ3MuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhcHR1cmVXZWJzaXRlSWNvbihwYWdlOiBQYWdlLCBqb2JJZDogc3RyaW5nLCBzb3VyY2VVcmw6IHN0cmluZyB8IG51bGwsIGZhbGxiYWNrTmFtZTogc3RyaW5nLCBicmFuZENvbG9yPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIGNvbnN0IHJlbmRlckNhcmQgPSBhc3luYyAoc3JjOiBzdHJpbmcgfCBudWxsKSA9PiB7XG4gICAgYXdhaXQgcGFnZS5ldmFsdWF0ZSgoeyBzb3VyY2UsIG5hbWUsIGNvbG9yIH0pID0+IHtcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWFpd2VidmlkZW8tYnJhbmQtaWNvbl0nKT8ucmVtb3ZlKCk7XG4gICAgICBjb25zdCBjYXJkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBjYXJkLmRhdGFzZXQuYWl3ZWJ2aWRlb0JyYW5kSWNvbiA9ICd0cnVlJztcbiAgICAgIGNhcmQuc3R5bGUuY3NzVGV4dCA9IGBwb3NpdGlvbjpmaXhlZDtsZWZ0OjE2cHg7dG9wOjE2cHg7d2lkdGg6NTEycHg7aGVpZ2h0OjUxMnB4O3otaW5kZXg6MjE0NzQ4MzY0NztkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7YmFja2dyb3VuZDojZmZmO2JvcmRlci1yYWRpdXM6OTZweDtvdmVyZmxvdzpoaWRkZW47Ym94LXNoYWRvdzowIDMwcHggODBweCByZ2JhKDIwLDE1LDM5LC4xOCk7Y29sb3I6JHsvXiNbMC05YS1mXXs2fSQvaS50ZXN0KGNvbG9yIHx8ICcnKSA/IGNvbG9yIDogJyM2ZDRhZmYnfWA7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGNvbnN0IGltYWdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gICAgICAgIGltYWdlLmFsdCA9ICcnO1xuICAgICAgICBpbWFnZS5zcmMgPSBzb3VyY2U7XG4gICAgICAgIGltYWdlLnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpibG9jazttYXgtd2lkdGg6NzAlO21heC1oZWlnaHQ6NzAlO29iamVjdC1maXQ6Y29udGFpbic7XG4gICAgICAgIGNhcmQuYXBwZW5kQ2hpbGQoaW1hZ2UpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbW9ub2dyYW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIG1vbm9ncmFtLnRleHRDb250ZW50ID0gKG5hbWUudHJpbSgpWzBdIHx8ICdXJykudG9Mb2NhbGVVcHBlckNhc2UoKTtcbiAgICAgICAgbW9ub2dyYW0uc3R5bGUuY3NzVGV4dCA9ICdmb250OjcwMCAyNTBweC8xIEFyaWFsLHNhbnMtc2VyaWY7bGV0dGVyLXNwYWNpbmc6LS4wOGVtO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC0uMDRlbSknO1xuICAgICAgICBjYXJkLmFwcGVuZENoaWxkKG1vbm9ncmFtKTtcbiAgICAgIH1cbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2FyZCk7XG4gICAgfSwgeyBzb3VyY2U6IHNyYywgbmFtZTogZmFsbGJhY2tOYW1lLCBjb2xvcjogYnJhbmRDb2xvciB9KTtcbiAgICBjb25zdCBjYXJkID0gcGFnZS5sb2NhdG9yKCdbZGF0YS1haXdlYnZpZGVvLWJyYW5kLWljb25dJyk7XG4gICAgaWYgKHNyYykge1xuICAgICAgYXdhaXQgY2FyZC5sb2NhdG9yKCdpbWcnKS53YWl0Rm9yKHsgc3RhdGU6ICd2aXNpYmxlJywgdGltZW91dDogNl8wMDAgfSk7XG4gICAgICBhd2FpdCBwYWdlLndhaXRGb3JGdW5jdGlvbigoKSA9PiB7XG4gICAgICAgIGNvbnN0IGltYWdlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MSW1hZ2VFbGVtZW50PignW2RhdGEtYWl3ZWJ2aWRlby1icmFuZC1pY29uXSBpbWcnKTtcbiAgICAgICAgcmV0dXJuIEJvb2xlYW4oaW1hZ2U/LmNvbXBsZXRlICYmIGltYWdlLm5hdHVyYWxXaWR0aCA+PSA4ICYmIGltYWdlLm5hdHVyYWxIZWlnaHQgPj0gOCk7XG4gICAgICB9LCB1bmRlZmluZWQsIHsgdGltZW91dDogNl8wMDAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IGNhcmQuc2NyZWVuc2hvdCh7IHR5cGU6ICdqcGVnJywgcXVhbGl0eTogOTYgfSk7XG4gICAgYXdhaXQgY2FyZC5ldmFsdWF0ZSgoZWxlbWVudCkgPT4gZWxlbWVudC5yZW1vdmUoKSkuY2F0Y2goKCkgPT4ge30pO1xuICAgIHJldHVybiBhd2FpdCBzYXZlSW1hZ2VGaWxlKGpvYklkLCAnd2Vic2l0ZS1pY29uLmpwZycsIGJ1ZmZlcik7XG4gIH07XG4gIHRyeSB7XG4gICAgaWYgKHNvdXJjZVVybCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgdmFsaWRhdGVVcmwoc291cmNlVXJsKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHJlbmRlckNhcmQoc291cmNlVXJsKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2NhcHR1cmVdIG9yaWdpbmFsIHdlYnNpdGUgaWNvbiB1bmF2YWlsYWJsZSwgY3JlYXRpbmcgYSBicmFuZCBtb25vZ3JhbSBmYWxsYmFjazogJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhd2FpdCByZW5kZXJDYXJkKG51bGwpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGF3YWl0IHBhZ2UubG9jYXRvcignW2RhdGEtYWl3ZWJ2aWRlby1icmFuZC1pY29uXScpLmV2YWx1YXRlQWxsKChlbGVtZW50cykgPT4gZWxlbWVudHMuZm9yRWFjaCgoZWxlbWVudCkgPT4gZWxlbWVudC5yZW1vdmUoKSkpLmNhdGNoKCgpID0+IHt9KTtcbiAgICBjb25zb2xlLndhcm4oYFtjYXB0dXJlXSB3ZWJzaXRlIGljb24gc2tpcHBlZDogJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFnZVByaW9yaXR5KHVybDogVVJMKSB7XG4gIGNvbnN0IHBhdGhOYW1lID0gdXJsLnBhdGhuYW1lLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IHBvc2l0aXZlID0gWydwcm9kdWN0JywgJ3Nob3AnLCAnc3RvcmUnLCAnY2F0YWxvZycsICdjb2xsZWN0aW9uJywgJ2NhdGVnb3J5JywgJ2RyZXNzJywgJ2Nsb3RoZXMnLCAnc2hvZScsICdzYWxlJywgJ3ByaWNpbmcnLCAncGxhbicsICdmZWF0dXJlJywgJ3NvbHV0aW9uJywgJ3NlcnZpY2UnLCAnYm9va2luZycsICdyZXNlcnZlJywgJ2Rhc2hib2FyZCcsICdkZW1vJywgJ2Fib3V0JywgJ2xvY2F0aW9uJ107XG4gIGNvbnN0IG5lZ2F0aXZlID0gWydwcml2YWN5JywgJ3Rlcm1zJywgJ3BvbGljeScsICdsb2dpbicsICdyZWdpc3RlcicsICdhY2NvdW50JywgJ2xvZ291dCcsICdzZWFyY2gnLCAndGFnJywgJ2F1dGhvciddO1xuICBsZXQgc2NvcmUgPSAwO1xuICBmb3IgKGNvbnN0IHRva2VuIG9mIHBvc2l0aXZlKSBpZiAocGF0aE5hbWUuaW5jbHVkZXModG9rZW4pKSBzY29yZSArPSAxMDtcbiAgZm9yIChjb25zdCB0b2tlbiBvZiBuZWdhdGl2ZSkgaWYgKHBhdGhOYW1lLmluY2x1ZGVzKHRva2VuKSkgc2NvcmUgLT0gMjA7XG4gIHNjb3JlIC09IE1hdGgubWluKDEwLCBwYXRoTmFtZS5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKS5sZW5ndGgpO1xuICByZXR1cm4gc2NvcmU7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRpc2NvdmVySW50ZXJuYWxQYWdlcyhwYWdlOiBQYWdlLCBzb3VyY2VVcmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3Qgb3JpZ2luID0gbmV3IFVSTChzb3VyY2VVcmwpLm9yaWdpbjtcbiAgY29uc3QgaHJlZnMgPSBhd2FpdCBwYWdlLmxvY2F0b3IoJ2FbaHJlZl0nKS5ldmFsdWF0ZUFsbCgoYW5jaG9ycykgPT4gYW5jaG9ycy5tYXAoKGEpID0+IChhIGFzIEhUTUxBbmNob3JFbGVtZW50KS5ocmVmKSk7XG4gIGNvbnN0IHJvb3QgPSBuZXcgVVJMKHNvdXJjZVVybCk7XG4gIHJvb3QuaGFzaCA9ICcnO1xuICBjb25zdCBjYW5kaWRhdGVzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgZm9yIChjb25zdCBocmVmIG9mIGhyZWZzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoaHJlZik7XG4gICAgICB1cmwuaGFzaCA9ICcnO1xuICAgICAgaWYgKHVybC5vcmlnaW4gIT09IG9yaWdpbiB8fCAhWydodHRwOicsICdodHRwczonXS5pbmNsdWRlcyh1cmwucHJvdG9jb2wpKSBjb250aW51ZTtcbiAgICAgIGlmICgvXFwuKHBkZnx6aXB8anBlP2d8cG5nfGdpZnx3ZWJwfHN2Z3xtcDR8d2VibSkkL2kudGVzdCh1cmwucGF0aG5hbWUpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB1cmwudG9TdHJpbmcoKTtcbiAgICAgIGlmIChub3JtYWxpemVkID09PSByb290LnRvU3RyaW5nKCkpIGNvbnRpbnVlO1xuICAgICAgY2FuZGlkYXRlcy5zZXQobm9ybWFsaXplZCwgTWF0aC5tYXgoY2FuZGlkYXRlcy5nZXQobm9ybWFsaXplZCkgPz8gLTk5OSwgcGFnZVByaW9yaXR5KHVybCkpKTtcbiAgICB9IGNhdGNoIHsgLyogbWFsZm9ybWVkIGxpbmsgKi8gfVxuICB9XG4gIGNvbnN0IHNvcnRlZCA9IFsuLi5jYW5kaWRhdGVzLmVudHJpZXMoKV0uc29ydCgoYSwgYikgPT4gYlsxXSAtIGFbMV0pLm1hcCgoW3VybF0pID0+IHVybCk7XG4gIHJldHVybiBbcm9vdC50b1N0cmluZygpLCAuLi5zb3J0ZWQuc2xpY2UoMCwgTWF0aC5tYXgoMCwgTUFYX1BBR0VTIC0gMSkpXTtcbn1cblxuLyoqIFJlY29yZCBvbmx5IGEgY29uY2lzZSwgaW50ZW50aW9uYWwgdG91ci4gUmV0dXJucyB0aGUgYXBwcm94aW1hdGUgcmVjb3JkZWQgdG91ciBsZW5ndGguICovXG5hc3luYyBmdW5jdGlvbiByZWNvcmRTbW9vdGhTY3JvbGwocGFnZTogUGFnZSk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGNvbnN0IHN0YXJ0ZWQgPSBEYXRlLm5vdygpO1xuICBhd2FpdCB3aXRoVGltZW91dChwYWdlLmV2YWx1YXRlKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzbGVlcCA9IChtczogbnVtYmVyKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICAgIGNvbnN0IG1heFkgPSBNYXRoLm1heCgwLCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsSGVpZ2h0IC0gaW5uZXJIZWlnaHQpO1xuICAgIGNvbnN0IHN0ZXBzID0gTWF0aC5tYXgoMSwgTWF0aC5taW4oMTgsIE1hdGguY2VpbChtYXhZIC8gTWF0aC5tYXgoNjAwLCBpbm5lckhlaWdodCAqIDAuODUpKSkpO1xuICAgIHdpbmRvdy5zY3JvbGxUbygwLCAwKTtcbiAgICBhd2FpdCBzbGVlcCgzNTApO1xuICAgIGZvciAobGV0IGluZGV4ID0gMTsgaW5kZXggPD0gc3RlcHM7IGluZGV4KyspIHtcbiAgICAgIHdpbmRvdy5zY3JvbGxUbyh7IHRvcDogTWF0aC5yb3VuZCgobWF4WSAqIGluZGV4KSAvIHN0ZXBzKSwgYmVoYXZpb3I6ICdzbW9vdGgnIH0pO1xuICAgICAgYXdhaXQgc2xlZXAoNDMwKTtcbiAgICB9XG4gICAgYXdhaXQgc2xlZXAoNTAwKTtcbiAgICB3aW5kb3cuc2Nyb2xsVG8oeyB0b3A6IDAsIGJlaGF2aW9yOiAnc21vb3RoJyB9KTtcbiAgICBhd2FpdCBzbGVlcCg4NTApO1xuICB9KSwgMThfMDAwLCAnU0NST0xMX1JFQ09SRElORycpO1xuICByZXR1cm4gTWF0aC5tYXgoMSwgKERhdGUubm93KCkgLSBzdGFydGVkKSAvIDEwMDApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjb252ZXJ0UmVjb3JkaW5nKGlucHV0OiBzdHJpbmcsIG91dHB1dDogc3RyaW5nLCBzdGFydFNlY29uZHMgPSAwLCBkdXJhdGlvblNlY29uZHM/OiBudW1iZXIpIHtcbiAgbGV0IHNvdXJjZUR1cmF0aW9uID0gMDtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0ZpbGVBc3luYygnZmZwcm9iZScsIFsnLXYnLCAnZXJyb3InLCAnLXNob3dfZW50cmllcycsICdmb3JtYXQ9ZHVyYXRpb24nLCAnLW9mJywgJ2RlZmF1bHQ9bnc9MTpuaz0xJywgaW5wdXRdKTtcbiAgICBzb3VyY2VEdXJhdGlvbiA9IE51bWJlcihzdGRvdXQudHJpbSgpKSB8fCAwO1xuICB9IGNhdGNoIHsgLyogZmZtcGVnIGJlbG93IHdpbGwgcHJvdmlkZSB0aGUgcmVhbCBlcnJvciBpZiB0aGUgZmlsZSBpcyBpbnZhbGlkICovIH1cbiAgY29uc3Qgc2FmZVN0YXJ0ID0gc291cmNlRHVyYXRpb24gPiAxID8gTWF0aC5taW4oTWF0aC5tYXgoMCwgc3RhcnRTZWNvbmRzIC0gMC4xNSksIE1hdGgubWF4KDAsIHNvdXJjZUR1cmF0aW9uIC0gMSkpIDogTWF0aC5tYXgoMCwgc3RhcnRTZWNvbmRzIC0gMC4xNSk7XG4gIGNvbnN0IHJlbWFpbmluZyA9IHNvdXJjZUR1cmF0aW9uID4gMCA/IE1hdGgubWF4KDAuOCwgc291cmNlRHVyYXRpb24gLSBzYWZlU3RhcnQpIDogMjI7XG4gIGNvbnN0IHNhZmVEdXJhdGlvbiA9IGR1cmF0aW9uU2Vjb25kcyAmJiBkdXJhdGlvblNlY29uZHMgPiAwID8gTWF0aC5taW4oMjIsIGR1cmF0aW9uU2Vjb25kcyArIDAuNSwgcmVtYWluaW5nKSA6IE1hdGgubWluKDIyLCByZW1haW5pbmcpO1xuICBhd2FpdCBleGVjRmlsZUFzeW5jKCdmZm1wZWcnLCBbXG4gICAgJy15JyxcbiAgICAuLi4oc2FmZVN0YXJ0ID4gMC4xNSA/IFsnLXNzJywgc2FmZVN0YXJ0LnRvRml4ZWQoMyldIDogW10pLFxuICAgICctaScsIGlucHV0LFxuICAgIC4uLihzYWZlRHVyYXRpb24gPiAwID8gWyctdCcsIHNhZmVEdXJhdGlvbi50b0ZpeGVkKDMpXSA6IFtdKSxcbiAgICAnLXZmJywgJ3NjYWxlPTE5MjA6MTA4MDpmb3JjZV9vcmlnaW5hbF9hc3BlY3RfcmF0aW89ZGVjcmVhc2U6ZmxhZ3M9bGFuY3pvcyxwYWQ9MTkyMDoxMDgwOihvdy1pdykvMjoob2gtaWgpLzI6Y29sb3I9YmxhY2snLFxuICAgICctcicsICczMCcsICctYzp2JywgJ2xpYngyNjQnLCAnLXByZXNldCcsICdtZWRpdW0nLCAnLWNyZicsICcxOCcsICctcGl4X2ZtdCcsICd5dXY0MjBwJyxcbiAgICAnLW1vdmZsYWdzJywgJytmYXN0c3RhcnQnLCAnLWFuJywgb3V0cHV0LFxuICBdLCB7IHRpbWVvdXQ6IDUgKiA2MF8wMDAsIG1heEJ1ZmZlcjogMTYgKiAxMDI0ICogMTAyNCB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2NyZWVuc2hvdFBhZ2UocGFnZTogUGFnZSwgZnVsbFBhZ2UgPSB0cnVlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IHBhZ2Uuc2NyZWVuc2hvdCh7IHR5cGU6ICdqcGVnJywgcXVhbGl0eTogZnVsbFBhZ2UgPyA5MCA6IDk0LCBmdWxsUGFnZSwgdGltZW91dDogZnVsbFBhZ2UgPyAyNV8wMDAgOiAxNV8wMDAgfSk7XG4gIH0gY2F0Y2ggKGZpcnN0RXJyb3IpIHtcbiAgICAvLyBBIGh1Z2UvaW5maW5pdGUgcGFnZSBjYW4gbWFrZSBmdWxsLXBhZ2UgY2FwdHVyZSBleHBlbnNpdmUuIEtlZXAgdGhlIHJlYWxcbiAgICAvLyB2aXNpYmxlIHBhZ2UgcmF0aGVyIHRoYW4gZmFpbGluZyB0aGUgd2hvbGUgcHJvamVjdC5cbiAgICBpZiAoIWZ1bGxQYWdlKSB0aHJvdyBmaXJzdEVycm9yO1xuICAgIGNvbnNvbGUud2FybihgW2NhcHR1cmVdIGZhbGxiYWNrIHZpZXdwb3J0ICR7cGFnZS51cmwoKX06ICR7KGZpcnN0RXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG4gICAgcmV0dXJuIHBhZ2Uuc2NyZWVuc2hvdCh7IHR5cGU6ICdqcGVnJywgcXVhbGl0eTogOTIsIHRpbWVvdXQ6IDE1XzAwMCB9KTtcbiAgfVxufVxuXG4vLyBCaWxpbmd1YWwgKEVuZ2xpc2gvQXJhYmljKSB0ZXh0IGhldXJpc3RpY3MgXHUyMDE0IHJlYWwgZS1jb21tZXJjZSBhbmQgc3VwcG9ydCBVSVxuLy8gY29weSB2YXJpZXMgYSBsb3QsIHNvIHNldmVyYWwgY2FuZGlkYXRlIHN0cmluZ3MgYXJlIHRyaWVkIGluIG9yZGVyIGFuZCB0aGVcbi8vIGZpcnN0IHZpc2libGUgbWF0Y2ggd2lucy4gTm90aGluZyBoZXJlIGlzIGV2ZXIgc2hvd24gdG8gdGhlIGVuZCB1c2VyOyBpdFxuLy8gb25seSBkZWNpZGVzIHdoZXJlIHRoZSBjYXB0dXJlIGJyb3dzZXIgY2xpY2tzLlxuY29uc3QgQUREX1RPX0NBUlRfVEVYVFMgPSBbJ2FkZCB0byBjYXJ0JywgJ2FkZCB0byBiYWcnLCAnYWRkIHRvIGJhc2tldCcsICdidXkgbm93JywgJ1x1MDYyM1x1MDYzNlx1MDY0MSBcdTA2MjVcdTA2NDRcdTA2NDkgXHUwNjI3XHUwNjQ0XHUwNjMzXHUwNjQ0XHUwNjI5JywgJ1x1MDYyM1x1MDYzNlx1MDY0MSBcdTA2MjdcdTA2NDRcdTA2NDkgXHUwNjI3XHUwNjQ0XHUwNjMzXHUwNjQ0XHUwNjI5JywgJ1x1MDYyNVx1MDYzNlx1MDYyN1x1MDY0MVx1MDYyOSBcdTA2NDRcdTA2NDRcdTA2MzNcdTA2NDRcdTA2MjknLCAnXHUwNjI3XHUwNjM2XHUwNjI3XHUwNjQxXHUwNjI5IFx1MDY0NFx1MDY0NFx1MDYzM1x1MDY0NFx1MDYyOScsICdcdTA2MjdcdTA2MzRcdTA2MkFcdTA2MzFcdTA2NEEgXHUwNjI3XHUwNjQ0XHUwNjIyXHUwNjQ2JywgJ1x1MDYyN1x1MDYzNFx1MDYyQVx1MDYzMSBcdTA2MjdcdTA2NDRcdTA2MjJcdTA2NDYnXTtcbmNvbnN0IENBUlRfVEVYVFMgPSBbJ3ZpZXcgY2FydCcsICdteSBjYXJ0JywgJ1x1MDYzM1x1MDY0NFx1MDYyOSBcdTA2MjdcdTA2NDRcdTA2MkFcdTA2MzNcdTA2NDhcdTA2NDInLCAnXHUwNjMzXHUwNjQ0XHUwNjJBXHUwNjRBJywgJ1x1MDYzOVx1MDYzMVx1MDYzNiBcdTA2MjdcdTA2NDRcdTA2MzNcdTA2NDRcdTA2MjknLCAnXHUwNjI3XHUwNjQ0XHUwNjMzXHUwNjQ0XHUwNjI5J107XG5jb25zdCBDQVJUX1NFTEVDVE9SUyA9IFsnYVtocmVmKj1cIi9jYXJ0XCIgaV0nLCAnYVtocmVmKj1cIi9iYXNrZXRcIiBpXScsICdidXR0b25bYXJpYS1sYWJlbCo9XCJjYXJ0XCIgaV0nLCAnW3JvbGU9XCJidXR0b25cIl1bYXJpYS1sYWJlbCo9XCJjYXJ0XCIgaV0nLCAnW2NsYXNzKj1cImNhcnRcIiBpXSBhJ107XG5jb25zdCBDSEVDS09VVF9URVhUUyA9IFsnY2hlY2tvdXQnLCAncHJvY2VlZCB0byBjaGVja291dCcsICdzZWN1cmUgY2hlY2tvdXQnLCAnXHUwNjI3XHUwNjQ0XHUwNjJGXHUwNjQxXHUwNjM5JywgJ1x1MDYyNVx1MDYyQVx1MDY0NVx1MDYyN1x1MDY0NSBcdTA2MjdcdTA2NDRcdTA2MzdcdTA2NDRcdTA2MjgnLCAnXHUwNjI3XHUwNjJBXHUwNjQ1XHUwNjI3XHUwNjQ1IFx1MDYyN1x1MDY0NFx1MDYzN1x1MDY0NFx1MDYyOCcsICdcdTA2MjVcdTA2NDNcdTA2NDVcdTA2MjdcdTA2NDQgXHUwNjI3XHUwNjQ0XHUwNjM3XHUwNjQ0XHUwNjI4JywgJ1x1MDYyN1x1MDY0M1x1MDY0NVx1MDYyN1x1MDY0NCBcdTA2MjdcdTA2NDRcdTA2MzdcdTA2NDRcdTA2MjgnXTtcbmNvbnN0IENIRUNLT1VUX1NFTEVDVE9SUyA9IFsnYVtocmVmKj1cImNoZWNrb3V0XCIgaV0nLCAnYnV0dG9uW25hbWUqPVwiY2hlY2tvdXRcIiBpXScsICdidXR0b25baWQqPVwiY2hlY2tvdXRcIiBpXScsICdbcm9sZT1cImJ1dHRvblwiXVthcmlhLWxhYmVsKj1cImNoZWNrb3V0XCIgaV0nXTtcbmNvbnN0IENPTlZFUlNJT05fVEVYVFMgPSBbJ2dldCBzdGFydGVkJywgJ3N0YXJ0IG5vdycsICdzdGFydCBmcmVlJywgJ3NpZ24gdXAnLCAnY3JlYXRlIGFjY291bnQnLCAnYm9vayBub3cnLCAncmVzZXJ2ZScsICdjaG9vc2UgcGxhbicsICdzZWxlY3QgcGxhbicsICdcdTA2MjdcdTA2MjhcdTA2MkZcdTA2MjMgXHUwNjI3XHUwNjQ0XHUwNjIyXHUwNjQ2JywgJ1x1MDYyN1x1MDYyOFx1MDYyRlx1MDYyMyBcdTA2NDVcdTA2MkNcdTA2MjdcdTA2NDZcdTA2MjcnLCAnXHUwNjI1XHUwNjQ2XHUwNjM0XHUwNjI3XHUwNjIxIFx1MDYyRFx1MDYzM1x1MDYyN1x1MDYyOCcsICdcdTA2MjdcdTA2NDZcdTA2MzRcdTA2MjdcdTA2MjEgXHUwNjJEXHUwNjMzXHUwNjI3XHUwNjI4JywgJ1x1MDYyN1x1MDYyRFx1MDYyQ1x1MDYzMiBcdTA2MjdcdTA2NDRcdTA2MjJcdTA2NDYnLCAnXHUwNjI3XHUwNjJFXHUwNjJBXHUwNjMxIFx1MDYyN1x1MDY0NFx1MDYyRVx1MDYzN1x1MDYyOSddO1xuY29uc3QgQ0hBVF9URVhUUyA9IFsnY2hhdCcsICdhc3Npc3RhbnQnLCAnbGl2ZSBjaGF0JywgJ3N1cHBvcnQnLCAnaGVscCcsICdhc2sgdXMnLCAnXHUwNjI3XHUwNjQ0XHUwNjJGXHUwNjMxXHUwNjJGXHUwNjM0XHUwNjI5JywgJ1x1MDYyN1x1MDY0NFx1MDY0NVx1MDYzM1x1MDYyN1x1MDYzOVx1MDYyRicsICdcdTA2MjdcdTA2NDRcdTA2MkZcdTA2MzlcdTA2NDUnLCAnXHUwNjQ1XHUwNjMzXHUwNjI3XHUwNjM5XHUwNjJGXHUwNjI5JywgJ1x1MDYyQVx1MDY0OFx1MDYyN1x1MDYzNVx1MDY0NCBcdTA2NDVcdTA2MzlcdTA2NDZcdTA2MjcnXTtcbmNvbnN0IE9QVElPTl9TRUxFQ1RPUlMgPSBbXG4gICdbY2xhc3MqPVwic2l6ZVwiIGldIGJ1dHRvbicsICdbY2xhc3MqPVwic2l6ZVwiIGldIFtyb2xlPVwiYnV0dG9uXCJdJywgJ1tjbGFzcyo9XCJzaXplXCIgaV0gbGFiZWwnLFxuICAnW2NsYXNzKj1cInZhcmlhbnRcIiBpXSBidXR0b24nLCAnW2NsYXNzKj1cIm9wdGlvblwiIGldIGJ1dHRvbicsXG4gICdidXR0b25bYXJpYS1sYWJlbCo9XCJzaXplXCIgaV0nLCAnW2RhdGEtb3B0aW9uXSBidXR0b24nLFxuXTtcbmNvbnN0IENIQVRfTEFVTkNIRVJfU0VMRUNUT1JTID0gW1xuICAnW2NsYXNzKj1cImNoYXQtd2lkZ2V0XCIgaV0nLCAnW2NsYXNzKj1cImNoYXR3aWRnZXRcIiBpXScsICdbaWQqPVwiY2hhdC13aWRnZXRcIiBpXScsXG4gICdbY2xhc3MqPVwibGl2ZWNoYXRcIiBpXScsICdbaWQqPVwibGl2ZWNoYXRcIiBpXScsICdbY2xhc3MqPVwibGl2ZS1jaGF0XCIgaV0nLFxuICAnW2NsYXNzKj1cImNoYXQtbGF1bmNoZXJcIiBpXScsICdbY2xhc3MqPVwiY2hhdC1idXR0b25cIiBpXScsICdbY2xhc3MqPVwiY2hhdGJvdFwiIGldJyxcbiAgJ1thcmlhLWxhYmVsKj1cImNoYXRcIiBpXScsICdbYXJpYS1sYWJlbCo9XCJhc3Npc3RhbnRcIiBpXScsICdbYXJpYS1sYWJlbCo9XCJzdXBwb3J0XCIgaV0nLFxuICAnaWZyYW1lW3RpdGxlKj1cImNoYXRcIiBpXScsICdpZnJhbWVbdGl0bGUqPVwiYXNzaXN0YW50XCIgaV0nLFxuXTtcblxuLyoqIFRyeSBlYWNoIGNhbmRpZGF0ZSBsb2NhdG9yL3RleHQgaW4gb3JkZXI7IGNsaWNrIGFuZCByZXR1cm4gdHJ1ZSBvbiB0aGUgZmlyc3QgdmlzaWJsZSBoaXQuICovXG5hc3luYyBmdW5jdGlvbiB0cnlDbGlja0ZpcnN0VmlzaWJsZShwYWdlOiBQYWdlLCBzZWxlY3RvcnM6IHN0cmluZ1tdLCB0ZXh0czogc3RyaW5nW10pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgZm9yIChjb25zdCBzZWxlY3RvciBvZiBzZWxlY3RvcnMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZWwgPSBwYWdlLmxvY2F0b3Ioc2VsZWN0b3IpLmZpcnN0KCk7XG4gICAgICBpZiAoKGF3YWl0IGVsLmNvdW50KCkpICYmIChhd2FpdCBlbC5pc1Zpc2libGUoKS5jYXRjaCgoKSA9PiBmYWxzZSkpKSB7XG4gICAgICAgIGF3YWl0IGVsLmNsaWNrKHsgdGltZW91dDogNDAwMCB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7IC8qIHRyeSB0aGUgbmV4dCBjYW5kaWRhdGUgKi8gfVxuICB9XG4gIGZvciAoY29uc3QgdGV4dCBvZiB0ZXh0cykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBlbCA9IHBhZ2UuZ2V0QnlUZXh0KHRleHQsIHsgZXhhY3Q6IGZhbHNlIH0pLmZpcnN0KCk7XG4gICAgICBpZiAoKGF3YWl0IGVsLmNvdW50KCkpICYmIChhd2FpdCBlbC5pc1Zpc2libGUoKS5jYXRjaCgoKSA9PiBmYWxzZSkpKSB7XG4gICAgICAgIGF3YWl0IGVsLmNsaWNrKHsgdGltZW91dDogNDAwMCB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7IC8qIHRyeSB0aGUgbmV4dCBjYW5kaWRhdGUgKi8gfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBCZXN0LWVmZm9ydCByZWFsIGludGVyYWN0aW9uIHN0YXRlcyB0aGF0IGEgcHVyZWx5IGxpbmstY3Jhd2xpbmcgY2FwdHVyZVxuICogY2FuIG5ldmVyIHJlYWNoIG9uIGl0cyBvd246IGEgcHJvZHVjdCB3aXRoIGEgcmVhbCBvcHRpb24gc2VsZWN0ZWQsIGFuXG4gKiBpdGVtIGFjdHVhbGx5IGFkZGVkIHRvIHRoZSBjYXJ0LCB0aGUgY2FydCBpdHNlbGYsIGEgY2hlY2tvdXQgZW50cnlcbiAqIHN0YXRlICh3aXRob3V0IHN1Ym1pdHRpbmcgYW55IHBheW1lbnQvb3JkZXIpLCBhIGdlbmVyaWMgY29udmVyc2lvbiBlbnRyeVxuICogc3RhdGUgZm9yIG5vbi1zdG9yZSBzaXRlcywgYW5kIGFuIG9wZW5lZCBBSSBhc3Npc3RhbnQvbGl2ZS1jaGF0IHdpZGdldC4gRXZlcnkgc3RlcCBpcyBpc29sYXRlZFxuICogYW5kIG9wdGlvbmFsIFx1MjAxNCBhIHNpdGUgd2l0aCBkaWZmZXJlbnQgbWFya3VwIHNpbXBseSB5aWVsZHMgZmV3ZXIgb2YgdGhlc2VcbiAqIGV4dHJhIGNhcHR1cmVzLCBhbmQgdGhpcyBuZXZlciBmYWlscyBvciBzbG93cyBkb3duIHRoZSBjb3JlIGNhcHR1cmUuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhcHR1cmVJbnRlcmFjdGlvblN0YXRlcyhcbiAgYnJvd3NlcjogQnJvd3NlcixcbiAgam9iSWQ6IHN0cmluZyxcbiAgc291cmNlVXJsOiBzdHJpbmcsXG4gIGRpc2NvdmVyZWRQYWdlczogQ2FwdHVyZWRQYWdlW10sXG4gIGRlYWRsaW5lQXQ6IG51bWJlcixcbik6IFByb21pc2U8Q2FwdHVyZWRQYWdlW10+IHtcbiAgY29uc3QgZXh0cmE6IENhcHR1cmVkUGFnZVtdID0gW107XG4gIGlmIChEYXRlLm5vdygpID49IGRlYWRsaW5lQXQgLSAxNV8wMDApIHJldHVybiBleHRyYTtcblxuICBjb25zdCBjb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHsgdmlld3BvcnQ6IFZJRVdQT1JULCBkZXZpY2VTY2FsZUZhY3RvcjogMSB9KTtcbiAgYXdhaXQgY29udGV4dC5yb3V0ZSgnKiovKicsIGd1YXJkTmF2aWdhdGlvbik7XG5cbiAgdHJ5IHtcbiAgICAvLyAxKSBQcm9kdWN0IHBhZ2UgXHUyMTkyIHNlbGVjdCBhIHJlYWwgb3B0aW9uIFx1MjE5MiBhZGQgdG8gY2FydCBcdTIxOTIgdmlldyBjYXJ0IFx1MjE5MiBjaGVja291dCBlbnRyeS5cbiAgICBjb25zdCBwcm9kdWN0Q2FuZGlkYXRlID0gZGlzY292ZXJlZFBhZ2VzLmZpbmQoKHApID0+IC9wcm9kdWN0fHNob3B8aXRlbXxkcmVzc3xzaG9lfGJhZ3xkZXRhaWwvaS50ZXN0KHAudXJsKSkgPz8gZGlzY292ZXJlZFBhZ2VzWzFdO1xuICAgIGlmIChwcm9kdWN0Q2FuZGlkYXRlICYmIERhdGUubm93KCkgPCBkZWFkbGluZUF0IC0gMTVfMDAwKSB7XG4gICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7XG4gICAgICBjb25maWd1cmVQYWdlKHBhZ2UpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd2l0aFRpbWVvdXQoKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCBwYWdlLmdvdG8ocHJvZHVjdENhbmRpZGF0ZS51cmwsIHsgd2FpdFVudGlsOiAnZG9tY29udGVudGxvYWRlZCcsIHRpbWVvdXQ6IDMwXzAwMCB9KTtcbiAgICAgICAgICBhd2FpdCB3YWl0Rm9yUmVhZHkocGFnZSwgZmFsc2UpO1xuXG4gICAgICAgICAgY29uc3Qgc2VsZWN0ZWRPcHRpb24gPSBhd2FpdCB0cnlDbGlja0ZpcnN0VmlzaWJsZShwYWdlLCBPUFRJT05fU0VMRUNUT1JTLCBbXSk7XG4gICAgICAgICAgaWYgKHNlbGVjdGVkT3B0aW9uKSB7XG4gICAgICAgICAgICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDQwMCk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShwYWdlLCBmYWxzZSk7XG4gICAgICAgICAgICBleHRyYS5wdXNoKHsgdXJsOiBwYWdlLnVybCgpLCB0aXRsZTogJ1Byb2R1Y3QgcGFnZSBcdTIwMTQgcmVhbCBvcHRpb24gc2VsZWN0ZWQnLCBzY3JlZW5zaG90VXJsOiBhd2FpdCBzYXZlSW1hZ2VGaWxlKGpvYklkLCAnaW50ZXJhY3Rpb24tcHJvZHVjdC1zZWxlY3RlZC5qcGcnLCBidWZmZXIpIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGFkZGVkID0gYXdhaXQgdHJ5Q2xpY2tGaXJzdFZpc2libGUocGFnZSwgW10sIEFERF9UT19DQVJUX1RFWFRTKTtcbiAgICAgICAgICBpZiAoYWRkZWQpIHtcbiAgICAgICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoNzAwKTtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICAgIGV4dHJhLnB1c2goeyB1cmw6IHBhZ2UudXJsKCksIHRpdGxlOiAnQWRkZWQgdG8gY2FydCcsIHNjcmVlbnNob3RVcmw6IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdpbnRlcmFjdGlvbi1hZGRlZC10by1jYXJ0LmpwZycsIGJ1ZmZlcikgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG9wZW5lZENhcnQgPSBhd2FpdCB0cnlDbGlja0ZpcnN0VmlzaWJsZShwYWdlLCBDQVJUX1NFTEVDVE9SUywgQ0FSVF9URVhUUyk7XG4gICAgICAgICAgICBpZiAob3BlbmVkQ2FydCkge1xuICAgICAgICAgICAgICBhd2FpdCBwYWdlLndhaXRGb3JUaW1lb3V0KDYwMCk7XG4gICAgICAgICAgICAgIGNvbnN0IGNhcnRCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShwYWdlLCBmYWxzZSk7XG4gICAgICAgICAgICAgIGV4dHJhLnB1c2goeyB1cmw6IHBhZ2UudXJsKCksIHRpdGxlOiAnU2hvcHBpbmcgY2FydCcsIHNjcmVlbnNob3RVcmw6IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdpbnRlcmFjdGlvbi1jYXJ0LmpwZycsIGNhcnRCdWZmZXIpIH0pO1xuXG4gICAgICAgICAgICAgIC8vIENhcHR1cmUgb25seSB0aGUgY2hlY2tvdXQgRU5UUlkgc3RhdGUuIE5ldmVyIGZpbGwgcGF5bWVudCBmaWVsZHMsXG4gICAgICAgICAgICAgIC8vIHN1Ym1pdCBhbiBvcmRlciwgb3IgY2xpY2sgYSBmaW5hbCBwdXJjaGFzZS9jb25maXJtYXRpb24gY29udHJvbC5cbiAgICAgICAgICAgICAgaWYgKERhdGUubm93KCkgPCBkZWFkbGluZUF0IC0gN18wMDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcGVuZWRDaGVja291dCA9IGF3YWl0IHRyeUNsaWNrRmlyc3RWaXNpYmxlKHBhZ2UsIENIRUNLT1VUX1NFTEVDVE9SUywgQ0hFQ0tPVVRfVEVYVFMpO1xuICAgICAgICAgICAgICAgIGlmIChvcGVuZWRDaGVja291dCkge1xuICAgICAgICAgICAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCg4MDApO1xuICAgICAgICAgICAgICAgICAgY29uc3QgY2hlY2tvdXRCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShwYWdlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICBleHRyYS5wdXNoKHsgdXJsOiBwYWdlLnVybCgpLCB0aXRsZTogJ0NoZWNrb3V0IFx1MjAxNCByZWFsIGVudHJ5IHN0YXRlJywgc2NyZWVuc2hvdFVybDogYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ2ludGVyYWN0aW9uLWNoZWNrb3V0LmpwZycsIGNoZWNrb3V0QnVmZmVyKSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pKCksIDI4XzAwMCwgJ1BST0RVQ1RfSU5URVJBQ1RJT04nKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tjYXB0dXJlXSBwcm9kdWN0IGludGVyYWN0aW9uIHNraXBwZWQ6JywgKGVyciBhcyBFcnJvcikubWVzc2FnZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBhd2FpdCBwYWdlLmNsb3NlKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIDIpIEdlbmVyaWMgY29udmVyc2lvbiBlbnRyeSBmb3IgU2FhUy9zZXJ2aWNlL2Jvb2tpbmcgc2l0ZXMuIFRoaXMgb25seVxuICAgIC8vIG5hdmlnYXRlcyB0byB0aGUgZmlyc3QgcmVhbCBzaWdudXAvYm9va2luZy9wbGFuIGVudHJ5IHN0YXRlOyBpdCBuZXZlclxuICAgIC8vIHN1Ym1pdHMgYSBmb3JtLCBjcmVhdGVzIGFuIGFjY291bnQsIGJvb2tzLCBvciBwdXJjaGFzZXMgYW55dGhpbmcuXG4gICAgaWYgKERhdGUubm93KCkgPCBkZWFkbGluZUF0IC0gMTBfMDAwKSB7XG4gICAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7XG4gICAgICBjb25maWd1cmVQYWdlKHBhZ2UpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd2l0aFRpbWVvdXQoKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCBwYWdlLmdvdG8oc291cmNlVXJsLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAzMF8wMDAgfSk7XG4gICAgICAgICAgYXdhaXQgd2FpdEZvclJlYWR5KHBhZ2UsIGZhbHNlKTtcbiAgICAgICAgICBjb25zdCBvcGVuZWQgPSBhd2FpdCB0cnlDbGlja0ZpcnN0VmlzaWJsZShwYWdlLCBbXSwgQ09OVkVSU0lPTl9URVhUUyk7XG4gICAgICAgICAgaWYgKG9wZW5lZCkge1xuICAgICAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yVGltZW91dCg4MDApO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdFBhZ2UocGFnZSwgZmFsc2UpO1xuICAgICAgICAgICAgZXh0cmEucHVzaCh7IHVybDogcGFnZS51cmwoKSwgdGl0bGU6ICdDb252ZXJzaW9uIC8gc2lnbnVwIC8gYm9va2luZyBlbnRyeSBzdGF0ZScsIHNjcmVlbnNob3RVcmw6IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdpbnRlcmFjdGlvbi1jb252ZXJzaW9uLmpwZycsIGJ1ZmZlcikgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpLCAxOF8wMDAsICdDT05WRVJTSU9OX0VOVFJZJyk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbY2FwdHVyZV0gY29udmVyc2lvbiBlbnRyeSBza2lwcGVkOicsIChlcnIgYXMgRXJyb3IpLm1lc3NhZ2UpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgYXdhaXQgcGFnZS5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAzKSBBSSBhc3Npc3RhbnQgLyBsaXZlLWNoYXQgd2lkZ2V0LCBpZiB0aGUgc2l0ZSBoYXMgb25lLlxuICAgIGlmIChEYXRlLm5vdygpIDwgZGVhZGxpbmVBdCAtIDEwXzAwMCkge1xuICAgICAgY29uc3QgcGFnZSA9IGF3YWl0IGNvbnRleHQubmV3UGFnZSgpO1xuICAgICAgY29uZmlndXJlUGFnZShwYWdlKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHdpdGhUaW1lb3V0KChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgcGFnZS5nb3RvKHNvdXJjZVVybCwgeyB3YWl0VW50aWw6ICdkb21jb250ZW50bG9hZGVkJywgdGltZW91dDogMzBfMDAwIH0pO1xuICAgICAgICAgIGF3YWl0IHdhaXRGb3JSZWFkeShwYWdlLCBmYWxzZSk7XG4gICAgICAgICAgY29uc3Qgb3BlbmVkID0gYXdhaXQgdHJ5Q2xpY2tGaXJzdFZpc2libGUocGFnZSwgQ0hBVF9MQVVOQ0hFUl9TRUxFQ1RPUlMsIENIQVRfVEVYVFMpO1xuICAgICAgICAgIGlmIChvcGVuZWQpIHtcbiAgICAgICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclRpbWVvdXQoMTAwMCk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShwYWdlLCBmYWxzZSk7XG4gICAgICAgICAgICBleHRyYS5wdXNoKHsgdXJsOiBwYWdlLnVybCgpLCB0aXRsZTogJ0FJIGFzc2lzdGFudCAvIGxpdmUgY2hhdCcsIHNjcmVlbnNob3RVcmw6IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdpbnRlcmFjdGlvbi1haS1hc3Npc3RhbnQuanBnJywgYnVmZmVyKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCksIDIwXzAwMCwgJ0NIQVRfV0lER0VUJyk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbY2FwdHVyZV0gY2hhdCB3aWRnZXQgc2tpcHBlZDonLCAoZXJyIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGF3YWl0IHBhZ2UuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IGNvbnRleHQuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSk7XG4gIH1cbiAgcmV0dXJuIGV4dHJhO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjYXB0dXJlU2l0ZU5vdyhqb2JJZDogc3RyaW5nLCBzb3VyY2VVcmw6IHN0cmluZywgb25Qcm9ncmVzcz86IENhcHR1cmVQcm9ncmVzcyk6IFByb21pc2U8U2l0ZUNhcHR1cmU+IHtcbiAgY29uc3Qgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgY29uc3QgZGVhZGxpbmVBdCA9IHN0YXJ0ZWRBdCArIENBUFRVUkVfQlVER0VUX01TO1xuICBjb25zdCBkaXIgPSBwYXRoLmpvaW4oQVNTRVRTX0RJUiwgam9iSWQpO1xuICBjb25zdCB2aWRlb0RpciA9IHBhdGguam9pbihkaXIsICdicm93c2VyLXZpZGVvJyk7XG4gIGF3YWl0IGVuc3VyZURpcih2aWRlb0Rpcik7XG5cbiAgYXdhaXQgb25Qcm9ncmVzcz8uKDgsICdPcGVuaW5nIHlvdXIgd2Vic2l0ZSBzZWN1cmVseScsIDE1MCk7XG4gIGNvbnN0IGJyb3dzZXIgPSBhd2FpdCBjaHJvbWl1bS5sYXVuY2goe1xuICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgIHRpbWVvdXQ6IDMwXzAwMCxcbiAgICBhcmdzOiBbJy0tbm8tc2FuZGJveCcsICctLWRpc2FibGUtZGV2LXNobS11c2FnZScsICctLWRpc2FibGUtYmFja2dyb3VuZC10aW1lci10aHJvdHRsaW5nJ10sXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgLy8gQ29yZSBkZXNrdG9wIGNhcHR1cmU6IG5vIHZpZGVvIHJlY29yZGluZyBoZXJlLiBUaGlzIGtlZXBzIGxvYWRpbmcvbGF6eVxuICAgIC8vIGh5ZHJhdGlvbiB3b3JrIG91dCBvZiB0aGUgdXNlcidzIHNtb290aC1zY3JvbGwgcmVjb3JkaW5nLlxuICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoe1xuICAgICAgdmlld3BvcnQ6IFZJRVdQT1JULFxuICAgICAgZGV2aWNlU2NhbGVGYWN0b3I6IDEsXG4gICAgICB1c2VyQWdlbnQ6ICdNb3ppbGxhLzUuMCAoWDExOyBMaW51eCB4ODZfNjQpIEFwcGxlV2ViS2l0LzUzNy4zNiBDaHJvbWUvMTI2IFNhZmFyaS81MzcuMzYgQWlXZWJWaWRlb0NhcHR1cmUvMy4wJyxcbiAgICB9KTtcbiAgICBhd2FpdCBjb250ZXh0LnJvdXRlKCcqKi8qJywgZ3VhcmROYXZpZ2F0aW9uKTtcbiAgICBjb25zdCBwYWdlID0gYXdhaXQgY29udGV4dC5uZXdQYWdlKCk7XG4gICAgY29uZmlndXJlUGFnZShwYWdlKTtcbiAgICBhd2FpdCBvblByb2dyZXNzPy4oMTIsICdMb2FkaW5nIHRoZSBob21lcGFnZScsIDEyNSk7XG4gICAgY29uc29sZS5pbmZvKGBbY2FwdHVyZV0gb3BlbmluZyAke3NvdXJjZVVybH1gKTtcbiAgICBhd2FpdCBwYWdlLmdvdG8oc291cmNlVXJsLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiA0MF8wMDAgfSk7XG4gICAgYXdhaXQgd2FpdEZvclJlYWR5KHBhZ2UsIHRydWUpO1xuICAgIGF3YWl0IG9uUHJvZ3Jlc3M/LigyMCwgJ1NhdmluZyB0aGUgZnVsbHkgbG9hZGVkIGhvbWVwYWdlJywgMTAwKTtcblxuICAgIGNvbnN0IG1ldGEgPSBhd2FpdCBjb2xsZWN0TWV0YWRhdGEocGFnZSwgc291cmNlVXJsKTtcbiAgICBjb25zdCB1cmxzID0gYXdhaXQgZGlzY292ZXJJbnRlcm5hbFBhZ2VzKHBhZ2UsIHNvdXJjZVVybCk7XG4gICAgY29uc3Qgdmlld3BvcnRCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShwYWdlLCBmYWxzZSk7XG4gICAgY29uc3QgZnVsbEJ1ZmZlciA9IGF3YWl0IHNjcmVlbnNob3RQYWdlKHBhZ2UsIHRydWUpO1xuICAgIGNvbnN0IHNjcmVlbnNob3RVcmwgPSBhd2FpdCBzYXZlSW1hZ2VGaWxlKGpvYklkLCAnc2NyZWVuc2hvdC5qcGcnLCB2aWV3cG9ydEJ1ZmZlcik7XG4gICAgY29uc3QgZnVsbFBhZ2VTY3JlZW5zaG90VXJsID0gYXdhaXQgc2F2ZUltYWdlRmlsZShqb2JJZCwgJ3NjcmVlbnNob3QtZnVsbC5qcGcnLCBmdWxsQnVmZmVyKTtcbiAgICBjb25zdCB3ZWJzaXRlSWNvblVybCA9IGF3YWl0IGNhcHR1cmVXZWJzaXRlSWNvbihwYWdlLCBqb2JJZCwgbWV0YS5pY29uVXJsIHx8IG1ldGEubG9nb1VybCwgbWV0YS50aXRsZSwgbWV0YS5icmFuZENvbG9yc1swXSk7XG4gICAgY29uc29sZS5pbmZvKGBbY2FwdHVyZV0gc3VjY2VzcyAke3NvdXJjZVVybH0gc2NyZWVuc2hvdC5qcGcgKyBzY3JlZW5zaG90LWZ1bGwuanBnYCk7XG4gICAgYXdhaXQgcGFnZS5jbG9zZSgpO1xuICAgIGF3YWl0IGNvbnRleHQuY2xvc2UoKTtcbiAgICBhd2FpdCBvblByb2dyZXNzPy4oMjcsICdIb21lcGFnZSBjYXB0dXJlZCBpbiBmdWxsIHF1YWxpdHknLCA4MCk7XG5cbiAgICAvLyBPcHRpb25hbCBzbW9vdGgtc2Nyb2xsIHJlY29yZGluZy4gRmFpbHVyZSBuZXZlciBkZXN0cm95cyBzY3JlZW5zaG90cy5cbiAgICBsZXQgcmVjb3JkaW5nVXJsOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBpZiAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lQXQgLSAyNV8wMDApIHtcbiAgICAgIGF3YWl0IG9uUHJvZ3Jlc3M/LigyOSwgJ1NhdmluZyBhIHNtb290aC1zY3JvbGwgcHJldmlldycsIDY1KTtcbiAgICAgIGNvbnN0IHJlY29yZGluZ0NvbnRleHQgPSBhd2FpdCBicm93c2VyLm5ld0NvbnRleHQoe1xuICAgICAgICB2aWV3cG9ydDogVklFV1BPUlQsXG4gICAgICAgIGRldmljZVNjYWxlRmFjdG9yOiAxLFxuICAgICAgICByZWNvcmRWaWRlbzogeyBkaXI6IHZpZGVvRGlyLCBzaXplOiBWSUVXUE9SVCB9LFxuICAgICAgICB1c2VyQWdlbnQ6ICdNb3ppbGxhLzUuMCAoWDExOyBMaW51eCB4ODZfNjQpIEFwcGxlV2ViS2l0LzUzNy4zNiBDaHJvbWUvMTI2IFNhZmFyaS81MzcuMzYgQWlXZWJWaWRlb0NhcHR1cmUvMy4wJyxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgcmVjb3JkaW5nQ29udGV4dC5yb3V0ZSgnKiovKicsIGd1YXJkTmF2aWdhdGlvbik7XG4gICAgICBjb25zdCByZWNvcmRpbmdQYWdlID0gYXdhaXQgcmVjb3JkaW5nQ29udGV4dC5uZXdQYWdlKCk7XG4gICAgICBjb25maWd1cmVQYWdlKHJlY29yZGluZ1BhZ2UpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdmlkZW9DbG9ja1N0YXJ0ZWQgPSBEYXRlLm5vdygpO1xuICAgICAgICBhd2FpdCByZWNvcmRpbmdQYWdlLmdvdG8oc291cmNlVXJsLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAzNV8wMDAgfSk7XG4gICAgICAgIGF3YWl0IHdhaXRGb3JSZWFkeShyZWNvcmRpbmdQYWdlLCBmYWxzZSk7XG4gICAgICAgIGNvbnN0IHRyaW1TdGFydCA9IE1hdGgubWF4KDAsIChEYXRlLm5vdygpIC0gdmlkZW9DbG9ja1N0YXJ0ZWQpIC8gMTAwMCk7XG4gICAgICAgIGNvbnN0IHRvdXJEdXJhdGlvbiA9IGF3YWl0IHJlY29yZFNtb290aFNjcm9sbChyZWNvcmRpbmdQYWdlKTtcbiAgICAgICAgY29uc3QgcmVjb3JkaW5nID0gcmVjb3JkaW5nUGFnZS52aWRlbygpO1xuICAgICAgICBhd2FpdCByZWNvcmRpbmdQYWdlLmNsb3NlKCk7XG4gICAgICAgIGF3YWl0IHJlY29yZGluZ0NvbnRleHQuY2xvc2UoKTtcbiAgICAgICAgaWYgKHJlY29yZGluZykge1xuICAgICAgICAgIGNvbnN0IHdlYm1QYXRoID0gYXdhaXQgcmVjb3JkaW5nLnBhdGgoKTtcbiAgICAgICAgICBjb25zdCBtcDRQYXRoID0gcGF0aC5qb2luKGRpciwgJ3Njcm9sbC1yZWNvcmRpbmcubXA0Jyk7XG4gICAgICAgICAgYXdhaXQgY29udmVydFJlY29yZGluZyh3ZWJtUGF0aCwgbXA0UGF0aCwgdHJpbVN0YXJ0LCB0b3VyRHVyYXRpb24pO1xuICAgICAgICAgIHJlY29yZGluZ1VybCA9IGAvYXBpL2Fzc2V0cy8ke2pvYklkfS9zY3JvbGwtcmVjb3JkaW5nLm1wNGA7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tjYXB0dXJlXSBzbW9vdGgtc2Nyb2xsIHByZXZpZXcgc2tpcHBlZDonLCAoZXJyIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgICAgICAgYXdhaXQgcmVjb3JkaW5nUGFnZS5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgICAgYXdhaXQgcmVjb3JkaW5nQ29udGV4dC5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXNwb25zaXZlIG1vYmlsZSBjYXB0dXJlIGlzIG9wdGlvbmFsIGFuZCBpc29sYXRlZCBmcm9tIGRlc2t0b3Agc3VjY2Vzcy5cbiAgICBsZXQgbW9iaWxlU2NyZWVuc2hvdFVybDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IG1vYmlsZUZ1bGxQYWdlU2NyZWVuc2hvdFVybDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgaWYgKERhdGUubm93KCkgPCBkZWFkbGluZUF0IC0gMjBfMDAwKSB7XG4gICAgICBjb25zdCBtb2JpbGVDb250ZXh0ID0gYXdhaXQgYnJvd3Nlci5uZXdDb250ZXh0KHtcbiAgICAgICAgdmlld3BvcnQ6IE1PQklMRV9WSUVXUE9SVCxcbiAgICAgICAgc2NyZWVuOiBNT0JJTEVfVklFV1BPUlQsXG4gICAgICAgIGRldmljZVNjYWxlRmFjdG9yOiAxLFxuICAgICAgICBpc01vYmlsZTogdHJ1ZSxcbiAgICAgICAgaGFzVG91Y2g6IHRydWUsXG4gICAgICAgIHVzZXJBZ2VudDogJ01vemlsbGEvNS4wIChpUGhvbmU7IENQVSBpUGhvbmUgT1MgMTdfNSBsaWtlIE1hYyBPUyBYKSBBcHBsZVdlYktpdC82MDUuMS4xNSBWZXJzaW9uLzE3LjUgTW9iaWxlLzE1RTE0OCBTYWZhcmkvNjA0LjEgQWlXZWJWaWRlb0NhcHR1cmUvMy4wJyxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgbW9iaWxlQ29udGV4dC5yb3V0ZSgnKiovKicsIGd1YXJkTmF2aWdhdGlvbik7XG4gICAgICBjb25zdCBtb2JpbGVQYWdlID0gYXdhaXQgbW9iaWxlQ29udGV4dC5uZXdQYWdlKCk7XG4gICAgICBjb25maWd1cmVQYWdlKG1vYmlsZVBhZ2UpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgb25Qcm9ncmVzcz8uKDMyLCAnU2F2aW5nIHRoZSByZWFsIG1vYmlsZSBsYXlvdXQnLCA1NSk7XG4gICAgICAgIGF3YWl0IG1vYmlsZVBhZ2UuZ290byhzb3VyY2VVcmwsIHsgd2FpdFVudGlsOiAnZG9tY29udGVudGxvYWRlZCcsIHRpbWVvdXQ6IDM1XzAwMCB9KTtcbiAgICAgICAgYXdhaXQgd2FpdEZvclJlYWR5KG1vYmlsZVBhZ2UsIGZhbHNlKTtcbiAgICAgICAgY29uc3QgbW9iaWxlVmlld3BvcnRCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShtb2JpbGVQYWdlLCBmYWxzZSk7XG4gICAgICAgIGNvbnN0IG1vYmlsZUZ1bGxCdWZmZXIgPSBhd2FpdCBzY3JlZW5zaG90UGFnZShtb2JpbGVQYWdlLCB0cnVlKTtcbiAgICAgICAgbW9iaWxlU2NyZWVuc2hvdFVybCA9IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdzY3JlZW5zaG90LW1vYmlsZS5qcGcnLCBtb2JpbGVWaWV3cG9ydEJ1ZmZlcik7XG4gICAgICAgIG1vYmlsZUZ1bGxQYWdlU2NyZWVuc2hvdFVybCA9IGF3YWl0IHNhdmVJbWFnZUZpbGUoam9iSWQsICdzY3JlZW5zaG90LW1vYmlsZS1mdWxsLmpwZycsIG1vYmlsZUZ1bGxCdWZmZXIpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW2NhcHR1cmVdIG1vYmlsZSBsYXlvdXQgc2tpcHBlZDonLCAoZXJyIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGF3YWl0IG1vYmlsZVBhZ2UuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgICAgIGF3YWl0IG1vYmlsZUNvbnRleHQuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2hpbGQgcGFnZXMgc2hhcmUgb25lIGxpZ2h0d2VpZ2h0IGNvbnRleHQuIEVhY2ggcGFnZSBoYXMgaXRzIG93biBsb2NhbFxuICAgIC8vIGJ1ZGdldDsgb25lIHNsb3cgcm91dGUgc3VjaCBhcyAvb3VyLWxvY2F0aW9uIG9yIC9zYWxlcyBjYW4gYmUgc2tpcHBlZFxuICAgIC8vIHdpdGhvdXQga2lsbGluZyB0aGUgYnJvd3NlciBvciBpbnZhbGlkYXRpbmcgYWxsIHByZXZpb3VzIHNjcmVlbnNob3RzLlxuICAgIGNvbnN0IHBhZ2VzOiBDYXB0dXJlZFBhZ2VbXSA9IFt7IHVybDogc291cmNlVXJsLCB0aXRsZTogbWV0YS50aXRsZSwgc2NyZWVuc2hvdFVybDogZnVsbFBhZ2VTY3JlZW5zaG90VXJsIH1dO1xuICAgIGxldCBza2lwcGVkUGFnZXMgPSAwO1xuICAgIGNvbnN0IGNoaWxkQ29udGV4dCA9IGF3YWl0IGJyb3dzZXIubmV3Q29udGV4dCh7IHZpZXdwb3J0OiBWSUVXUE9SVCwgZGV2aWNlU2NhbGVGYWN0b3I6IDEgfSk7XG4gICAgYXdhaXQgY2hpbGRDb250ZXh0LnJvdXRlKCcqKi8qJywgZ3VhcmROYXZpZ2F0aW9uKTtcbiAgICB0cnkge1xuICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB1cmxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChEYXRlLm5vdygpID49IGRlYWRsaW5lQXQgLSAxMl8wMDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtjYXB0dXJlXSBzb2Z0IGJ1ZGdldCByZWFjaGVkIGFmdGVyICR7cGFnZXMubGVuZ3RofSBwYWdlKHMpOyByZXR1cm5pbmcgc3VjY2Vzc2Z1bCBwYXJ0aWFsIGNhcHR1cmVgKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGlsZCA9IGF3YWl0IGNoaWxkQ29udGV4dC5uZXdQYWdlKCk7XG4gICAgICAgIGNvbmZpZ3VyZVBhZ2UoY2hpbGQpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IG9uUHJvZ3Jlc3M/LihcbiAgICAgICAgICAgIDMzICsgTWF0aC5yb3VuZCgoaSAvIE1hdGgubWF4KDEsIHVybHMubGVuZ3RoIC0gMSkpICogNiksXG4gICAgICAgICAgICBgQ2FwdHVyaW5nIHBhZ2UgJHtpICsgMX0gb2YgJHt1cmxzLmxlbmd0aH1gLFxuICAgICAgICAgICAgTWF0aC5tYXgoMTAsICh1cmxzLmxlbmd0aCAtIGkpICogMTIpLFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc29sZS5pbmZvKGBbY2FwdHVyZV0gb3BlbmluZyAke3VybHNbaV19YCk7XG4gICAgICAgICAgYXdhaXQgd2l0aFRpbWVvdXQoKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IGNoaWxkLmdvdG8odXJsc1tpXSwgeyB3YWl0VW50aWw6ICdkb21jb250ZW50bG9hZGVkJywgdGltZW91dDogMzJfMDAwIH0pO1xuICAgICAgICAgICAgYXdhaXQgd2FpdEZvclJlYWR5KGNoaWxkLCBmYWxzZSk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZE1ldGEgPSBhd2FpdCBjb2xsZWN0TWV0YWRhdGEoY2hpbGQsIHVybHNbaV0pO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gYXdhaXQgc2NyZWVuc2hvdFBhZ2UoY2hpbGQsIHRydWUpO1xuICAgICAgICAgICAgY29uc3QgcGFnZVNjcmVlbnNob3RVcmwgPSBhd2FpdCBzYXZlSW1hZ2VGaWxlKGpvYklkLCBgcGFnZS0ke2l9LmpwZ2AsIGJ1ZmZlcik7XG4gICAgICAgICAgICBwYWdlcy5wdXNoKHsgdXJsOiBjaGlsZC51cmwoKSwgdGl0bGU6IGNoaWxkTWV0YS50aXRsZSwgc2NyZWVuc2hvdFVybDogcGFnZVNjcmVlbnNob3RVcmwgfSk7XG4gICAgICAgICAgICBjb25zb2xlLmluZm8oYFtjYXB0dXJlXSBzdWNjZXNzICR7dXJsc1tpXX0gcGFnZS0ke2l9LmpwZ2ApO1xuICAgICAgICAgIH0pKCksIE1hdGgubWluKENISUxEX1BBR0VfQlVER0VUX01TLCBNYXRoLm1heCgxMl8wMDAsIGRlYWRsaW5lQXQgLSBEYXRlLm5vdygpIC0gNV8wMDApKSwgJ0NISUxEX1BBR0UnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgc2tpcHBlZFBhZ2VzKys7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbY2FwdHVyZV0gc2tpcHBlZCAke3VybHNbaV19ICR7KGVyciBhcyBFcnJvcikubWVzc2FnZX1gKTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICBhd2FpdCBjaGlsZC5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBhd2FpdCBjaGlsZENvbnRleHQuY2xvc2UoKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5pbmZvKGBbY2FwdHVyZV0gZmluaXNoZWQgc3VjY2Vzc2Z1bD0ke3BhZ2VzLmxlbmd0aH0gZmFpbGVkPSR7c2tpcHBlZFBhZ2VzfWApO1xuICAgIC8vIHBhZ2VDb3VudCByZWZsZWN0cyBkaXN0aW5jdCBzaXRlIHBhZ2VzIHZpc2l0ZWQsIHNob3duIHRvIHRoZSB1c2VyIGFzXG4gICAgLy8gXCJOIHBhZ2VzIGNhcHR1cmVkXCIuIEludGVyYWN0aW9uLXN0YXRlIHNjcmVlbnNob3RzIGJlbG93IGFyZSBleHRyYVxuICAgIC8vIHN0YXRlcyBvZiBwYWdlcyBhbHJlYWR5IGNvdW50ZWQgaGVyZSAoZS5nLiBcInByb2R1Y3Qgd2l0aCBhIHNpemVcbiAgICAvLyBzZWxlY3RlZFwiKSwgbm90IG5ldyBwYWdlcywgc28gdGhleSdyZSBhcHBlbmRlZCB0byBgcGFnZXNgIGZvciB0aGUgQUlcbiAgICAvLyBwbGFubmVyIHdpdGhvdXQgaW5mbGF0aW5nIHRoYXQgY291bnQuXG4gICAgY29uc3QgcGFnZUNvdW50ID0gcGFnZXMubGVuZ3RoO1xuXG4gICAgLy8gQmVzdC1lZmZvcnQgcmVhbCBpbnRlcmFjdGlvbiBzdGF0ZXMgKHByb2R1Y3Qgb3B0aW9uIHNlbGVjdGVkLCBhZGRlZCB0b1xuICAgIC8vIGNhcnQsIGNhcnQgdmlldywgQUkgYXNzaXN0YW50IG9wZW5lZCkuIFRoZXNlIGFyZSB3aGF0IG1ha2UgYnV5L3RvdXIvXG4gICAgLy8gdHV0b3JpYWwgdmlkZW9zIGFibGUgdG8gc2hvdyBhIHJlYWwgcHVyY2hhc2Ugam91cm5leSBhbmQgYSByZWFsXG4gICAgLy8gYXNzaXN0YW50IHdpZGdldCBpbnN0ZWFkIG9mIG9ubHkgc3RhdGljIGxhbmRpbmcgcGFnZXMuXG4gICAgaWYgKERhdGUubm93KCkgPCBkZWFkbGluZUF0IC0gMTVfMDAwKSB7XG4gICAgICBhd2FpdCBvblByb2dyZXNzPy4oMzgsICdDYXB0dXJpbmcgcmVhbCBpbnRlcmFjdGlvbnMgKG9wdGlvbnMsIGNhcnQsIGNoZWNrb3V0LCBjb252ZXJzaW9uLCBjaGF0KScsIDIwKTtcbiAgICAgIGNvbnN0IGludGVyYWN0aW9uUGFnZXMgPSBhd2FpdCBjYXB0dXJlSW50ZXJhY3Rpb25TdGF0ZXMoYnJvd3Nlciwgam9iSWQsIHNvdXJjZVVybCwgcGFnZXMsIGRlYWRsaW5lQXQpO1xuICAgICAgaWYgKGludGVyYWN0aW9uUGFnZXMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUuaW5mbyhgW2NhcHR1cmVdIGludGVyYWN0aW9uIHN0YXRlcyBjYXB0dXJlZD0ke2ludGVyYWN0aW9uUGFnZXMubGVuZ3RofWApO1xuICAgICAgICBwYWdlcy5wdXNoKC4uLmludGVyYWN0aW9uUGFnZXMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IG9uUHJvZ3Jlc3M/Lig0MCwgYFdlYnNpdGUgY2FwdHVyZSBjb21wbGV0ZSBcdTIwMTQgJHtwYWdlQ291bnR9IHBhZ2Uke3BhZ2VDb3VudCA9PT0gMSA/ICcnIDogJ3MnfSBzYXZlZGAsIDApO1xuICAgIHJldHVybiB7XG4gICAgICAuLi5tZXRhLFxuICAgICAgbG9nb1VybDogd2Vic2l0ZUljb25VcmwgPz8gbWV0YS5sb2dvVXJsLFxuICAgICAgc2NyZWVuc2hvdFVybCxcbiAgICAgIGZ1bGxQYWdlU2NyZWVuc2hvdFVybCxcbiAgICAgIG1vYmlsZVNjcmVlbnNob3RVcmwsXG4gICAgICBtb2JpbGVGdWxsUGFnZVNjcmVlbnNob3RVcmwsXG4gICAgICByZWNvcmRpbmdVcmwsXG4gICAgICBwYWdlcyxcbiAgICAgIHBhZ2VDb3VudCxcbiAgICB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gKGVyciBhcyBFcnJvcikubWVzc2FnZTtcbiAgICBpZiAoL3RpbWVvdXQvaS50ZXN0KG1lc3NhZ2UpIHx8IERhdGUubm93KCkgPj0gZGVhZGxpbmVBdCkgdGhyb3cgbmV3IEVycm9yKCdDQVBUVVJFX1RJTUVPVVQnKTtcbiAgICB0aHJvdyBlcnI7XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgYnJvd3Nlci5jbG9zZSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAvLyBQbGF5d3JpZ2h0IHN0b3JlcyBpdHMgcmF3IFdlYk0gaW4gYnJvd3Nlci12aWRlby8uIFRoZSBmaW5hbCB0cmltbWVkIE1QNFxuICAgIC8vIGxpdmVzIGF0IHRoZSBqb2Igcm9vdCwgc28gcmVtb3ZlIHRoZSByYXcgY2FwdHVyZSB0byBhdm9pZCBkaXNrIGdyb3d0aC5cbiAgICBhd2FpdCBmcy5ybSh2aWRlb0RpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pLmNhdGNoKCgpID0+IHt9KTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FwdHVyZVNpdGUoam9iSWQ6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcsIG9uUHJvZ3Jlc3M/OiBDYXB0dXJlUHJvZ3Jlc3MpOiBQcm9taXNlPFNpdGVDYXB0dXJlPiB7XG4gIGF3YWl0IG9uUHJvZ3Jlc3M/LihcbiAgICA1LFxuICAgIGFjdGl2ZUNhcHR1cmVzID49IENBUFRVUkVfQ09OQ1VSUkVOQ1kgPyAnV2FpdGluZyBmb3IgYW4gYXZhaWxhYmxlIGNhcHR1cmUgc2xvdCcgOiAnUHJlcGFyaW5nIHdlYnNpdGUgY2FwdHVyZScsXG4gICAgYWN0aXZlQ2FwdHVyZXMgPj0gQ0FQVFVSRV9DT05DVVJSRU5DWSA/IDE4MCA6IDE1MCxcbiAgKTtcbiAgYXdhaXQgYWNxdWlyZUNhcHR1cmVTbG90KCk7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGNhcHR1cmVTaXRlTm93KGpvYklkLCBzb3VyY2VVcmwsIG9uUHJvZ3Jlc3MpO1xuICB9IGZpbmFsbHkge1xuICAgIHJlbGVhc2VDYXB0dXJlU2xvdCgpO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFNjcmVlbnNob3QodXJsOiBzdHJpbmcpOiBQcm9taXNlPHsgc2NyZWVuc2hvdFVybDogc3RyaW5nOyBzY3JlZW5zaG90QnVmZmVyOiBCdWZmZXIgfT4ge1xuICBjb25zdCBzY3JlZW5zaG90VXJsID0gYGh0dHBzOi8vaW1hZ2UudGh1bS5pby9nZXQvd2lkdGgvMTQ0MC9jcm9wLzkwMC8ke3VybH1gO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goc2NyZWVuc2hvdFVybCwgeyBzaWduYWw6IEFib3J0U2lnbmFsLnRpbWVvdXQoMjBfMDAwKSB9KTtcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gICAgcmV0dXJuIHsgc2NyZWVuc2hvdFVybCwgc2NyZWVuc2hvdEJ1ZmZlcjogQnVmZmVyLmZyb20oYXdhaXQgcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSkgfTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHsgc2NyZWVuc2hvdFVybCwgc2NyZWVuc2hvdEJ1ZmZlcjogQnVmZmVyLmFsbG9jKDApIH07XG4gIH1cbn1cbiIsICJpbXBvcnQgZG5zIGZyb20gJ2Rucy9wcm9taXNlcyc7XG5pbXBvcnQgaXBhZGRyIGZyb20gJ2lwYWRkci5qcyc7XG5cbmNvbnN0IEJMT0NLRURfU0NIRU1FUyA9IG5ldyBTZXQoWydmaWxlJywgJ2Z0cCcsICdnb3BoZXInLCAnZGF0YScsICdkaWN0JywgJ3NtdHAnLCAnbGRhcCddKTtcblxuLy8gUmFuZ2VzIHRoYXQgaXBhZGRyLmpzJ3MgYWRkci5yYW5nZSgpIHJldHVybnMgZm9yIG5vbi1wdWJsaWMgYWRkcmVzc2VzXG5jb25zdCBQUklWQVRFX1JBTkdFUyA9IG5ldyBTZXQoW1xuICAncHJpdmF0ZScsXG4gICdsb29wYmFjaycsXG4gICdsaW5rTG9jYWwnLFxuICAnbXVsdGljYXN0JyxcbiAgJ3Vuc3BlY2lmaWVkJyxcbiAgJ2NhcnJpZXJHcmFkZU5hdCcsXG4gICdicm9hZGNhc3QnLFxuICAncmVzZXJ2ZWQnLFxuICAndW5pcXVlTG9jYWwnLCAgIC8vIElQdjYgVUxBIChmYzAwOjovNylcbiAgJ2lwdjRNYXBwZWQnLCAgICAvLyBibG9jayA6OmZmZmY6MTAueC54LnggZXRjXG5dKTtcblxuZXhwb3J0IGNsYXNzIFNzcmZFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ1NzcmZFcnJvcic7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNQcml2YXRlSVAoaXA6IHN0cmluZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIGNvbnN0IGFkZHIgPSBpcGFkZHIucGFyc2UoaXApO1xuICAgIGNvbnN0IHJhbmdlID0gYWRkci5yYW5nZSgpO1xuICAgIHJldHVybiBQUklWQVRFX1JBTkdFUy5oYXMocmFuZ2UpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBJZiBpcGFkZHIgY2FuJ3QgcGFyc2UgaXQsIHRyZWF0IGFzIHNhZmUgXHUyMDE0IEROUyBhbHJlYWR5IHJlc29sdmVkIGl0LFxuICAgIC8vIHNvIGl0J3MgYSB2YWxpZCBhZGRyZXNzIGZvcm1hdCB3ZSBqdXN0IGRvbid0IHJlY29nbml6ZS5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZhbGlkYXRlVXJsKHJhd1VybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgbGV0IHBhcnNlZDogVVJMO1xuICB0cnkge1xuICAgIHBhcnNlZCA9IG5ldyBVUkwocmF3VXJsKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IFNzcmZFcnJvcignSW52YWxpZCBVUkwgZm9ybWF0LicpO1xuICB9XG5cbiAgY29uc3Qgc2NoZW1lID0gcGFyc2VkLnByb3RvY29sLnJlcGxhY2UoJzonLCAnJyk7XG4gIGlmIChCTE9DS0VEX1NDSEVNRVMuaGFzKHNjaGVtZSkpIHtcbiAgICB0aHJvdyBuZXcgU3NyZkVycm9yKGBTY2hlbWUgXCIke3BhcnNlZC5wcm90b2NvbH1cIiBpcyBub3QgYWxsb3dlZC5gKTtcbiAgfVxuICBpZiAoIVsnaHR0cDonLCAnaHR0cHM6J10uaW5jbHVkZXMocGFyc2VkLnByb3RvY29sKSkge1xuICAgIHRocm93IG5ldyBTc3JmRXJyb3IoJ09ubHkgaHR0cCBhbmQgaHR0cHMgVVJMcyBhcmUgYWxsb3dlZC4nKTtcbiAgfVxuXG4gIGNvbnN0IGhvc3RuYW1lID0gcGFyc2VkLmhvc3RuYW1lO1xuXG4gIC8vIElmIHRoZSBob3N0IGlzIGFscmVhZHkgYSByYXcgSVAsIGNoZWNrIGl0IGRpcmVjdGx5XG4gIGlmIChpcGFkZHIuaXNWYWxpZChob3N0bmFtZSkpIHtcbiAgICBpZiAoaXNQcml2YXRlSVAoaG9zdG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgU3NyZkVycm9yKCdBY2Nlc3MgdG8gcHJpdmF0ZSBJUCBhZGRyZXNzZXMgaXMgbm90IGFsbG93ZWQuJyk7XG4gICAgfVxuICAgIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKTtcbiAgfVxuXG4gIC8vIFJlc29sdmUgaG9zdG5hbWUgYW5kIGNoZWNrIGFsbCByZXR1cm5lZCBJUHNcbiAgbGV0IGFkZHJlc3NlczogeyBhZGRyZXNzOiBzdHJpbmcgfVtdO1xuICB0cnkge1xuICAgIGFkZHJlc3NlcyA9IGF3YWl0IGRucy5sb29rdXAoaG9zdG5hbWUsIHsgYWxsOiB0cnVlIH0pO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgU3NyZkVycm9yKGBDYW5ub3QgcmVzb2x2ZSBob3N0IFwiJHtob3N0bmFtZX1cIi5gKTtcbiAgfVxuXG4gIGlmICghYWRkcmVzc2VzIHx8IGFkZHJlc3Nlcy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgU3NyZkVycm9yKGBDYW5ub3QgcmVzb2x2ZSBob3N0IFwiJHtob3N0bmFtZX1cIi5gKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgeyBhZGRyZXNzIH0gb2YgYWRkcmVzc2VzKSB7XG4gICAgaWYgKGlzUHJpdmF0ZUlQKGFkZHJlc3MpKSB7XG4gICAgICB0aHJvdyBuZXcgU3NyZkVycm9yKGBIb3N0IFwiJHtob3N0bmFtZX1cIiByZXNvbHZlcyB0byBhIHByaXZhdGUgSVAgYWRkcmVzcy5gKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG59XG4iLCAiaW1wb3J0IHBnIGZyb20gJ3BnJztcblxuY29uc3QgeyBQb29sIH0gPSBwZztcblxuaWYgKCFwcm9jZXNzLmVudi5EQVRBQkFTRV9VUkwpIHtcbiAgY29uc29sZS53YXJuKCdbZGJdIERBVEFCQVNFX1VSTCBub3Qgc2V0IFx1MjAxNCBkYXRhYmFzZSBmZWF0dXJlcyB3aWxsIGJlIHVuYXZhaWxhYmxlLicpO1xufVxuXG5leHBvcnQgY29uc3QgcG9vbCA9IG5ldyBQb29sKHtcbiAgY29ubmVjdGlvblN0cmluZzogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMLFxuICBtYXg6IDEwLFxuICBpZGxlVGltZW91dE1pbGxpczogMzBfMDAwLFxuICBjb25uZWN0aW9uVGltZW91dE1pbGxpczogNV8wMDAsXG4gIHNzbDogcHJvY2Vzcy5lbnYuREFUQUJBU0VfVVJMPy5pbmNsdWRlcygnbG9jYWxob3N0JykgPyBmYWxzZSA6IHsgcmVqZWN0VW5hdXRob3JpemVkOiBmYWxzZSB9LFxufSk7XG5cbnBvb2wub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICBjb25zb2xlLmVycm9yKCdbZGJdIGlkbGUgY2xpZW50IGVycm9yJywgZXJyLm1lc3NhZ2UpO1xufSk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxdWVyeTxUIGV4dGVuZHMgcGcuUXVlcnlSZXN1bHRSb3cgPSBwZy5RdWVyeVJlc3VsdFJvdz4oXG4gIHRleHQ6IHN0cmluZyxcbiAgdmFsdWVzPzogdW5rbm93bltdXG4pOiBQcm9taXNlPHBnLlF1ZXJ5UmVzdWx0PFQ+PiB7XG4gIGNvbnN0IGNsaWVudCA9IGF3YWl0IHBvb2wuY29ubmVjdCgpO1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBjbGllbnQucXVlcnk8VD4odGV4dCwgdmFsdWVzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBjbGllbnQucmVsZWFzZSgpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgcXVlcnkgfSBmcm9tICcuL3Bvb2wuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvc3RFdmVudCB7XG4gIGpvYklkOiBzdHJpbmc7XG4gIHByb3ZpZGVyOiBzdHJpbmc7XG4gIG1vZGVsOiBzdHJpbmc7XG4gIG9wZXJhdGlvbjogc3RyaW5nO1xuICBxdWFudGl0eTogbnVtYmVyO1xuICB1bml0OiBzdHJpbmc7XG4gIHVuaXRDb3N0VXNkOiBudW1iZXI7XG4gIG1ldGFkYXRhPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbi8qKlxuICogUmVjb3JkcyBhbiBpdGVtaXplZCBwcm92aWRlciBleHBlbnNlIGFuZCB1cGRhdGVzIHRoZSBqb2IgdG90YWwgdG9nZXRoZXIuXG4gKiBDb3N0IHRyYWNraW5nIGlzIGludGVudGlvbmFsbHkgYmVzdC1lZmZvcnQgc28gYSB0ZW1wb3JhcnkgYW5hbHl0aWNzLXRhYmxlXG4gKiBpc3N1ZSBjYW4gbmV2ZXIgdHVybiBhIHN1Y2Nlc3NmdWwgY3VzdG9tZXIgZ2VuZXJhdGlvbiBpbnRvIGEgZmFpbGVkIGpvYi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlY29yZEdlbmVyYXRpb25Db3N0KGV2ZW50OiBDb3N0RXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgcXVhbnRpdHkgPSBNYXRoLm1heCgwLCBOdW1iZXIoZXZlbnQucXVhbnRpdHkpIHx8IDApO1xuICBjb25zdCB1bml0Q29zdCA9IE1hdGgubWF4KDAsIE51bWJlcihldmVudC51bml0Q29zdFVzZCkgfHwgMCk7XG4gIGNvbnN0IHRvdGFsID0gcXVhbnRpdHkgKiB1bml0Q29zdDtcbiAgYXdhaXQgcXVlcnkoXG4gICAgYFdJVEggaW5zZXJ0ZWQgQVMgKFxuICAgICAgIElOU0VSVCBJTlRPIGdlbmVyYXRpb25fY29zdF9ldmVudHNcbiAgICAgICAgIChqb2JfaWQscHJvdmlkZXIsbW9kZWwsb3BlcmF0aW9uLHF1YW50aXR5LHVuaXQsdW5pdF9jb3N0X3VzZCx0b3RhbF9jb3N0X3VzZCxtZXRhZGF0YSlcbiAgICAgICBWQUxVRVMgKCQxLCQyLCQzLCQ0LCQ1LCQ2LCQ3LCQ4LCQ5KVxuICAgICAgIFJFVFVSTklORyB0b3RhbF9jb3N0X3VzZFxuICAgICApXG4gICAgIFVQREFURSBqb2JzIFNFVCBnZW5lcmF0aW9uX3Byb3ZpZGVyPSQyLFxuICAgICAgIGdlbmVyYXRpb25fY29zdF91c2Q9Q09BTEVTQ0UoZ2VuZXJhdGlvbl9jb3N0X3VzZCwwKSsoU0VMRUNUIHRvdGFsX2Nvc3RfdXNkIEZST00gaW5zZXJ0ZWQpLFxuICAgICAgIHVwZGF0ZWRfYXQ9Tk9XKCkgV0hFUkUgaWQ9JDFgLFxuICAgIFtldmVudC5qb2JJZCwgYCR7ZXZlbnQucHJvdmlkZXJ9OiR7ZXZlbnQubW9kZWx9YCwgZXZlbnQubW9kZWwsIGV2ZW50Lm9wZXJhdGlvbiwgcXVhbnRpdHksIGV2ZW50LnVuaXQsIHVuaXRDb3N0LCB0b3RhbCwgZXZlbnQubWV0YWRhdGEgPyBKU09OLnN0cmluZ2lmeShldmVudC5tZXRhZGF0YSkgOiBudWxsXSxcbiAgKS5jYXRjaCgoZXJyb3IpID0+IGNvbnNvbGUud2FybihgW2Nvc3RzXSBjb3VsZCBub3QgcmVjb3JkICR7ZXZlbnQub3BlcmF0aW9ufTogJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YCkpO1xufVxuXG5leHBvcnQgY29uc3QgR0VNSU5JX0NPU1RfQ0FUQUxPRyA9IHtcbiAgdGV4dDoge1xuICAgIGlucHV0VG9rZW46IE51bWJlcihwcm9jZXNzLmVudi5HRU1JTklfVEVYVF9JTlBVVF9DT1NUX1BFUl9NSUxMSU9OX1VTRCA/PyAwLjUwKSAvIDFfMDAwXzAwMCxcbiAgICBvdXRwdXRUb2tlbjogTnVtYmVyKHByb2Nlc3MuZW52LkdFTUlOSV9URVhUX09VVFBVVF9DT1NUX1BFUl9NSUxMSU9OX1VTRCA/PyAzLjAwKSAvIDFfMDAwXzAwMCxcbiAgfSxcbiAgdmlkZW86IHtcbiAgICBsaXRlNzIwOiAwLjA1LFxuICAgIGxpdGUxMDgwOiAwLjA4LFxuICAgIGZhc3Q3MjA6IDAuMTAsXG4gICAgZmFzdDEwODA6IDAuMTIsXG4gICAgZmFzdDRrOiAwLjMwLFxuICAgIHN0YW5kYXJkMTA4MDogMC40MCxcbiAgICBzdGFuZGFyZDRrOiAwLjYwLFxuICB9LFxuICBpbWFnZTogeyB0d29LOiAwLjEwMSwgZm91cks6IDAuMTUxIH0sXG4gIHR0c0F1ZGlvU2Vjb25kOiAwLjAwMDUsXG59IGFzIGNvbnN0O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVjb3JkR2VtaW5pVGV4dFVzYWdlKGpvYklkOiBzdHJpbmcsIG1vZGVsOiBzdHJpbmcsIG9wZXJhdGlvbjogc3RyaW5nLCB1c2FnZTogeyBwcm9tcHRUb2tlbkNvdW50PzogbnVtYmVyIHwgbnVsbDsgY2FuZGlkYXRlc1Rva2VuQ291bnQ/OiBudW1iZXIgfCBudWxsIH0gfCBudWxsIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGlucHV0VG9rZW5zID0gTWF0aC5tYXgoMCwgTnVtYmVyKHVzYWdlPy5wcm9tcHRUb2tlbkNvdW50ID8/IDApKTtcbiAgY29uc3Qgb3V0cHV0VG9rZW5zID0gTWF0aC5tYXgoMCwgTnVtYmVyKHVzYWdlPy5jYW5kaWRhdGVzVG9rZW5Db3VudCA/PyAwKSk7XG4gIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBpbnB1dFRva2VucyA/IHJlY29yZEdlbmVyYXRpb25Db3N0KHsgam9iSWQsIHByb3ZpZGVyOiAnZ2VtaW5pJywgbW9kZWwsIG9wZXJhdGlvbjogYCR7b3BlcmF0aW9ufV9pbnB1dGAsIHF1YW50aXR5OiBpbnB1dFRva2VucywgdW5pdDogJ3Rva2VuJywgdW5pdENvc3RVc2Q6IEdFTUlOSV9DT1NUX0NBVEFMT0cudGV4dC5pbnB1dFRva2VuIH0pIDogUHJvbWlzZS5yZXNvbHZlKCksXG4gICAgb3V0cHV0VG9rZW5zID8gcmVjb3JkR2VuZXJhdGlvbkNvc3QoeyBqb2JJZCwgcHJvdmlkZXI6ICdnZW1pbmknLCBtb2RlbCwgb3BlcmF0aW9uOiBgJHtvcGVyYXRpb259X291dHB1dGAsIHF1YW50aXR5OiBvdXRwdXRUb2tlbnMsIHVuaXQ6ICd0b2tlbicsIHVuaXRDb3N0VXNkOiBHRU1JTklfQ09TVF9DQVRBTE9HLnRleHQub3V0cHV0VG9rZW4gfSkgOiBQcm9taXNlLnJlc29sdmUoKSxcbiAgXSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUEsS0FBQyxTQUFVLE1BQU07QUFDYjtBQUlBLFlBQU0sV0FBVztBQUNqQixZQUFNLGNBQWM7QUFBQSxRQUNoQixXQUFXLElBQUksT0FBTyxJQUFJLFFBQVEsTUFBTSxRQUFRLE1BQU0sUUFBUSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQUEsUUFDcEYsWUFBWSxJQUFJLE9BQU8sSUFBSSxRQUFRLE1BQU0sUUFBUSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQUEsUUFDdkUsVUFBVSxJQUFJLE9BQU8sSUFBSSxRQUFRLE1BQU0sUUFBUSxLQUFLLEdBQUc7QUFBQSxRQUN2RCxXQUFXLElBQUksT0FBTyxJQUFJLFFBQVEsS0FBSyxHQUFHO0FBQUEsTUFDOUM7QUFHQSxZQUFNLGFBQWEsSUFBSSxPQUFPLGFBQWEsR0FBRztBQUM5QyxZQUFNLFdBQVcsSUFBSSxPQUFPLGlCQUFpQixHQUFHO0FBRWhELFlBQU0sWUFBWTtBQU1sQixZQUFNLFdBQVc7QUFDakIsWUFBTSxjQUFjO0FBQUEsUUFDaEIsV0FBVyxJQUFJLE9BQU8sV0FBVyxHQUFHO0FBQUEsUUFDcEMsVUFBVSxJQUFJLE9BQU8sVUFBVSxRQUFRLHVC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QUFBQSxFQUNuRDtBQUNGLENBQUM7QUFFRCxLQUFLLDRDQUE0QyxZQUFZO0FBQzNELFFBQU0sTUFBTSxNQUFTLFlBQWEsVUFBUSxVQUFPLEdBQUcsY0FBYyxDQUFDO0FBQ25FLE1BQUk7QUFDRixVQUFNLFFBQWEsVUFBSyxLQUFLLFFBQVE7QUFDckMsVUFBTSxTQUFjLFVBQUssS0FBSyxTQUFTO0FBQ3ZDLFVBQU1ILGVBQWMsVUFBVTtBQUFBLE1BQzVCO0FBQUEsTUFBTTtBQUFBLE1BQWE7QUFBQSxNQUFTO0FBQUEsTUFBTTtBQUFBLE1BQVM7QUFBQSxNQUFNO0FBQUEsTUFDakQ7QUFBQSxNQUFNO0FBQUEsTUFBUztBQUFBLE1BQU07QUFBQSxNQUNyQjtBQUFBLE1BQVE7QUFBQSxNQUFXO0FBQUEsTUFBWTtBQUFBLE1BQVc7QUFBQSxNQUFRO0FBQUEsTUFBTztBQUFBLE1BQWE7QUFBQSxJQUN4RSxDQUFDO0FBQ0QsVUFBTSxlQUFlLE9BQU8sTUFBTTtBQUNsQyxVQUFNLEVBQUUsT0FBTyxJQUFJLE1BQU1BLGVBQWMsV0FBVztBQUFBLE1BQ2hEO0FBQUEsTUFBTTtBQUFBLE1BQVM7QUFBQSxNQUFtQjtBQUFBLE1BQU87QUFBQSxNQUFpQjtBQUFBLE1BQXFCO0FBQUEsTUFBTztBQUFBLE1BQVc7QUFBQSxJQUNuRyxDQUFDO0FBQ0QsV0FBTyxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU87QUFBQSxFQUNyQyxVQUFFO0FBQ0EsVUFBUyxPQUFHLEtBQUssRUFBRSxXQUFXLE1BQU0sT0FBTyxLQUFLLENBQUM7QUFBQSxFQUNuRDtBQUNGLENBQUM7QUFFRCxLQUFLLDhGQUE4RixZQUFZO0FBQzdHLFFBQU0sTUFBTSxNQUFTLFlBQWEsVUFBUSxVQUFPLEdBQUcsY0FBYyxDQUFDO0FBQ25FLE1BQUk7QUFDRixVQUFNLFFBQWEsVUFBSyxLQUFLLFFBQVE7QUFDckMsVUFBTSxTQUFjLFVBQUssS0FBSyxTQUFTO0FBQ3ZDLFVBQVMsY0FBVSxPQUFPLHVCQUF1QjtBQUVqRCxVQUFNLGVBQWUsT0FBTyxNQUFNO0FBQ2xDLFVBQU0sZ0JBQWdCLE1BQVMsYUFBUyxRQUFRLE9BQU87QUFDdkQsV0FBTyxNQUFNLGVBQWUsdUJBQXVCO0FBQUEsRUFDckQsVUFBRTtBQUNBLFVBQVMsT0FBRyxLQUFLLEVBQUUsV0FBVyxNQUFNLE9BQU8sS0FBSyxDQUFDO0FBQUEsRUFDbkQ7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJpcGFkZHIiLCAiZXhlY0ZpbGUiLCAicHJvbWlzaWZ5IiwgImZzIiwgImV4ZWNGaWxlIiwgInByb21pc2lmeSIsICJleGVjRmlsZUFzeW5jIiwgInByb21pc2lmeSIsICJleGVjRmlsZSIsICJleGVjRmlsZUFzeW5jIiwgImV4ZWNGaWxlQXN5bmMiLCAicHJvbWlzaWZ5IiwgImV4ZWNGaWxlIiwgInN0YXQiXQp9Cg==
