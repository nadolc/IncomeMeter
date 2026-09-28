Pod::Spec.new do |s|
  s.name           = 'RouteLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts, updates and ends the Live Activity for the IncomeMeter route in progress'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'IncomeMeter'
  s.homepage       = 'https://github.com/nadolc/IncomeMeter'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.swift"
end
