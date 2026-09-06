#!/usr/bin/env python3
"""Generate the dependency-free Xcode project deterministically."""
from pathlib import Path
import hashlib, json
root = Path(__file__).resolve().parents[1]
def uid(s): return hashlib.sha1(s.encode()).hexdigest()[:24].upper()
def q(s): return json.dumps(str(s))
objects = {}
def obj(key, value):
    ident = uid(key)
    objects[ident] = value
    return ident
def refs(ids): return '(' + ','.join(ids) + ')'
allfiles = []
def file(path, kind):
    ident = obj('file:'+path, '{isa=PBXFileReference; lastKnownFileType='+kind+'; path='+q(path)+'; sourceTree="<group>";}')
    allfiles.append(ident)
    return ident
def phase(key, isa, files):
    builds = [obj(key+':'+f, '{isa=PBXBuildFile; fileRef='+f+';}') for f in files]
    return obj(key, '{isa='+isa+'; buildActionMask=2147483647; files='+refs(builds)+'; runOnlyForDeploymentPostprocessing=0;}')
shared = [file(str(p.relative_to(root)), 'sourcecode.swift') for p in sorted((root/'Shared').glob('*.swift'))]
main = [file(str(p.relative_to(root)), 'sourcecode.swift') for p in sorted((root/'GameDay').rglob('*.swift'))]
widget = [file('GameDayActivity/GameDayActivity.swift', 'sourcecode.swift')]
tests = [file(str(p.relative_to(root)), 'sourcecode.swift') for p in sorted((root/'GameDayTests').glob('*.swift'))]
uitests = [file(str(p.relative_to(root)), 'sourcecode.swift') for p in sorted((root/'GameDayUITests').glob('*.swift'))]
assets = file('GameDay/Resources/Assets.xcassets', 'folder.assetcatalog')
privacy = file('GameDay/Resources/PrivacyInfo.xcprivacy', 'text.xml')
products = []
def configs(name, extra):
    ids = []
    for config in ['Debug','Release']:
        settings = {'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'18.0','SWIFT_VERSION':'5.0','TARGETED_DEVICE_FAMILY':'1','CODE_SIGN_STYLE':'Automatic','DEVELOPMENT_TEAM':'TV6G82BJ4U','MARKETING_VERSION':'1.0','CURRENT_PROJECT_VERSION':'1','ENABLE_USER_SCRIPT_SANDBOXING':'YES','CLANG_ENABLE_MODULES':'YES','SWIFT_STRICT_CONCURRENCY':'complete','SWIFT_OPTIMIZATION_LEVEL':'-Onone' if config=='Debug' else '-O','SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG' if config=='Debug' else '', **extra}
        ids.append(obj(name+config, '{isa=XCBuildConfiguration; name='+config+'; buildSettings={'+''.join(k+'='+q(v)+';' for k,v in settings.items())+'};}'))
    return obj(name+'configs', '{isa=XCConfigurationList; buildConfigurations='+refs(ids)+'; defaultConfigurationIsVisible=0; defaultConfigurationName=Release;}')
def target(name, typ, ext, sources, resources, extra, dependencies=[], embed=[]):
    prod = obj(name+'product','{isa=PBXFileReference; explicitFileType='+('wrapper.application' if ext=='app' else 'wrapper.app-extension' if ext=='appex' else 'wrapper.cfbundle')+'; path='+name+'.'+ext+'; sourceTree=BUILT_PRODUCTS_DIR;}')
    products.append(prod)
    phases = [phase(name+'sources','PBXSourcesBuildPhase',sources),phase(name+'resources','PBXResourcesBuildPhase',resources),phase(name+'frameworks','PBXFrameworksBuildPhase',[])]
    if embed:
        builds = [obj(name+'embed'+p,'{isa=PBXBuildFile;fileRef='+p+';settings={ATTRIBUTES=(RemoveHeadersOnCopy,);};}') for p in embed]
        phases.append(obj(name+'embedphase','{isa=PBXCopyFilesBuildPhase; buildActionMask=2147483647;dstPath="";dstSubfolderSpec=13;files='+refs(builds)+';name="Embed App Extensions";runOnlyForDeploymentPostprocessing=0;}'))
    ident = obj(name+'target','{isa=PBXNativeTarget;buildConfigurationList='+configs(name,{'PRODUCT_NAME':name,**extra})+';buildPhases='+refs(phases)+';buildRules=();dependencies='+refs(dependencies)+';name='+name+';productName='+name+';productReference='+prod+';productType='+q(typ)+';}')
    return ident,prod
def dependency(name, target):
    proxy=obj(name+'proxy','{isa=PBXContainerItemProxy;containerPortal='+uid('project')+';proxyType=1;remoteGlobalIDString='+target+';remoteInfo='+q(name)+';}')
    return obj(name+'dependency','{isa=PBXTargetDependency;target='+target+';targetProxy='+proxy+';}')
w,wp=target('GameDayActivity','com.apple.product-type.app-extension','appex',widget+shared,[],{'PRODUCT_BUNDLE_IDENTIFIER':'com.wodsmith.gameday.activity','INFOPLIST_FILE':'GameDayActivity/Info.plist','SKIP_INSTALL':'YES','APPLICATION_EXTENSION_API_ONLY':'YES','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'})
a,ap=target('GameDay','com.apple.product-type.application','app',main+shared,[assets,privacy],{'PRODUCT_BUNDLE_IDENTIFIER':'com.wodsmith.gameday','INFOPLIST_FILE':'GameDay/Info.plist','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','ENABLE_TESTABILITY':'YES','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks'},[dependency('GameDayActivity',w)],[wp])
t,tp=target('GameDayTests','com.apple.product-type.bundle.unit-test','xctest',tests,[],{'PRODUCT_BUNDLE_IDENTIFIER':'com.wodsmith.gameday.tests','GENERATE_INFOPLIST_FILE':'YES','TEST_HOST':'$(BUILT_PRODUCTS_DIR)/GameDay.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/GameDay','BUNDLE_LOADER':'$(TEST_HOST)'},[dependency('GameDayTests',a)])
u,up=target('GameDayUITests','com.apple.product-type.bundle.ui-testing','xctest',uitests,[],{'PRODUCT_BUNDLE_IDENTIFIER':'com.wodsmith.gameday.uitests','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'GameDay'},[dependency('GameDayUITests',a)])
pg=obj('products','{isa=PBXGroup;children='+refs(products)+';name=Products;sourceTree="<group>";}')
mg=obj('mainGroup','{isa=PBXGroup;children='+refs(allfiles+[pg])+';sourceTree="<group>";}')
obj('project','{isa=PBXProject;attributes={BuildIndependentTargetsInParallel=YES;LastUpgradeCheck=2620;};buildConfigurationList='+configs('project',{})+';compatibilityVersion="Xcode 14.0";developmentRegion=en;hasScannedForEncodings=0;knownRegions=(en,Base,);mainGroup='+mg+';productRefGroup='+pg+';projectDirPath="";projectRoot="";targets='+refs([a,w,t,u])+';}')
project=root/'GameDay.xcodeproj';project.mkdir(exist_ok=True)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion=1;classes={};objectVersion=56;objects={\n'+''.join(k+'='+v+';\n' for k,v in objects.items())+'};rootObject='+uid('project')+';}\n')
def ref(i,n): return '<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="'+i+'" BuildableName="'+n+'" BlueprintName="'+n.split('.')[0]+'" ReferencedContainer="container:GameDay.xcodeproj"/>'
scheme=project/'xcshareddata/xcschemes';scheme.mkdir(parents=True,exist_ok=True)
(scheme/'GameDay.xcscheme').write_text('<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2620" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">'+ref(a,'GameDay.app')+'</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">'+ref(t,'GameDayTests.xctest')+'</TestableReference><TestableReference skipped="NO">'+ref(u,'GameDayUITests.xctest')+'</TestableReference></Testables></TestAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">'+ref(a,'GameDay.app')+'</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">'+ref(a,'GameDay.app')+'</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>')
print(project)
