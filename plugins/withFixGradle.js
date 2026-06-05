const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withFixGradle(config) {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === "groovy") {
            // Remove the line: enableBundleCompression = ...
            config.modResults.contents = config.modResults.contents.replace(
                /enableBundleCompression = .*\n/g,
                "// enableBundleCompression removed by plugin\n"
            );
        }
        return config;
    });
};
