// Adds native/ios/RecordStopIntent.swift (the "Record stop" Shortcuts action) to the iOS app target
// when `expo prebuild` generates the ios/ project.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILE = 'RecordStopIntent.swift';

const withRecordStopIntent = (config) => {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const target = path.join(cfg.modRequest.platformProjectRoot, projectName, FILE);
      fs.copyFileSync(path.join(cfg.modRequest.projectRoot, 'native', 'ios', FILE), target);
      return cfg;
    },
  ]);
  return withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filepath = `${projectName}/${FILE}`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project: cfg.modResults });
    }
    return cfg;
  });
};

module.exports = withRecordStopIntent;
