# Expo SDK 54 generated shell phases need explicit quoting in paths with spaces.
require 'xcodeproj'
root = File.expand_path('..', __dir__)
pods = Xcodeproj::Project.open(File.join(root, 'ios/Pods/Pods.xcodeproj'))
pods.targets.each do |target|
  target.shell_script_build_phases.each do |phase|
    if phase.shell_script&.include?('get-app-config-ios.sh')
      phase.shell_script = '/bin/bash "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
    end
  end
end
pods.save
app = Xcodeproj::Project.open(File.join(root, 'ios/SeaNSound.xcodeproj'))
app.targets.each do |target|
  target.shell_script_build_phases.each do |phase|
    if phase.name == 'Bundle React Native code and images'
      phase.shell_script = phase.shell_script.sub(/`"\$NODE_BINARY"[^\n]*`/, '/bin/bash "$PROJECT_ROOT/node_modules/react-native/scripts/react-native-xcode.sh"')
    end
  end
end
app.save
Dir.glob(File.join(root, 'node_modules/**/expo-constants/scripts/get-app-config-ios.sh')).each do |path|
  content = File.read(path).sub('$(basename $PROJECT_DIR)', '$(basename "$PROJECT_DIR")')
  File.write(path, content)
end
puts 'iOS build script paths quoted.'
# Keep the local exhibition build independent of Xcode's stalled template asset
# compiler. The app draws its own artwork and needs no native launch images.
app.targets.each do |target|
  target.resources_build_phase.files.to_a.each do |file|
    path = file.file_ref&.path.to_s
    file.remove_from_project if path.end_with?('.xcassets', '.storyboard')
  end
  target.build_configurations.each do |config|
    config.build_settings.delete('ASSETCATALOG_COMPILER_APPICON_NAME')
  end
end
app.save
info_path = File.join(root, 'ios/SeaNSound/Info.plist')
info = Xcodeproj::Plist.read_from_path(info_path)
info.delete('UILaunchStoryboardName')
info['UILaunchScreen'] = {}
Xcodeproj::Plist.write_to_path(info, info_path)
puts 'Simple system launch screen configured for the local prototype.'
