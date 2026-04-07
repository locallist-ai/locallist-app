const { withPodfile } = require("expo/config-plugins");

// Fixes RNFirebase non-modular header errors when using static frameworks
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    let podfile = config.modResults.contents;

    const postInstallFix = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

    if (!podfile.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
      podfile = podfile.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${postInstallFix}`
      );
    }

    config.modResults.contents = podfile;
    return config;
  });
};
