# FloriaJS
A minimal VanillaJS-based framework to manage component-based UI Tiles and Data dependencies declaratively based on the Factory Repository pattern

Floria == Factories of Light Objects Repositories In Action :)


# Linking on Windows without submodules

- Go to the folder where you want to create the link, e.g., `C:\repos\MyRepo\WebContent`
- Then assuming you cloned the FloriaJS project in `C:\repos\OSS\FloriaJS`, do (you'll need admin priviledges):
  - `mklink /D floria.v2.0 C:\repos\OSS\FloriaJS\WebContent\floria.v2.0`
  - `mklink /D jslibs C:\repos\OSS\FloriaJS\WebContent\jslibs`

- Then make sure those symlinked folders are added to your .gitignore in your receiving project.