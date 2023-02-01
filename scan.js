const ping = require('ping')
const ip = require('ip')
const fs = require('fs')
const { toMAC } = require('@network-utils/arp-lookup')
const { toVendor } = require('@network-utils/vendor-lookup')

let devices = []

const localIP = ip.address()
const subnet = localIP.slice(0, localIP.lastIndexOf('.') + 1)

async function checkHost(host) {
  try {
    const res = await ping.promise.probe(host)
    if (res.alive) {
      const mac = await toMAC(host)
      const vendor = toVendor(mac)
      devices.push({
        'ip-address': host,
        'mac-address': mac,
        'vendor-name': vendor,
        'response-time': res.time,
      })
    }
  } catch (err) {
    console.error(err)
  }
}

async function getVendorName(macAddress) {
  return new Promise((resolve, reject) => {
    macLookup(macAddress, (err, vendor) => {
      if (err) {
        reject(err)
      } else {
        resolve(vendor)
      }
    })
  })
}

function sortByIpAddress(array, keyName) {
  array.sort(function (a, b) {
    let aNum = 0
    let bNum = 0

    const aParts = a[keyName].split('.')
    const bParts = b[keyName].split('.')

    for (let i = 0; i < 4; i++) {
      aNum += aParts[i] * Math.pow(256, 3 - i)
      bNum += bParts[i] * Math.pow(256, 3 - i)
    }

    return aNum - bNum
  })
}

async function writeJSONFile(filename, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, JSON.stringify(data, null, 4), err => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

const scanNetwork = async () => {
  try {
    const hostChecks = []
    for (let i = 1; i <= 254; i++) {
      const host = subnet + i
      hostChecks.push(checkHost(host))
    }
    await Promise.all(hostChecks).catch(console.error)
    sortByIpAddress(devices, 'ip-address')
    await writeJSONFile('devices.json', devices)
    console.log(`Saved ${devices.length} devices to 'devices.json'.`)
  } catch (err) {
    console.error(err)
  }
}

module.exports = scanNetwork
