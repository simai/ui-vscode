# VS Code extension for Simai Framework

## Running the Extension for Debugging

#### 1. Install Dependencies Using the Command
```sh
$ npm install
```

#### 2. Generate the pinned SF registry
```sh
npm run generate
npm run generate:check
```

Generation uses the vendored, hash-checked
`simai.vertical-sizing@1.1.0` contract. A local `styles.css` or
`modifiers.json` is not required. The resulting
`src/registry/sf-autocomplete.json` preserves mobile and desktop values instead
of flattening the registry to one resolved mode.

Run the owner checks before debugging:

```sh
npm test
npm run generate:check
```

#### 3. Launch the Extension in Debugging Mode
Open the top panel of VS Code, navigate to **Run -> Start Debugging**, or press the **F5** key.

## Packaging the VS Code Extension

#### 1. Install `vsce`
```sh
npm install -g vsce
```

#### 2. Navigate to the Root Directory of Your Extension Project and Execute the Command
```sh
vsce package
```
This command will create a `.vsix` file in the current directory. This file contains everything necessary to install your extension.

## Installing the Extension via the VS Code Interface

#### 1. Open Visual Studio Code

#### 2. Go to the Extensions Section

#### 3. Install the Extension from the `.vsix` File
##### 3.1 Click on the three dots in the top right corner of the Extensions section and select **"Install from VSIX..."**
##### 3.2 In the opened window, locate and select the downloaded `.vsix` file
##### 3.3 After installing the extension, you may need to restart VS Code to apply the changes.
