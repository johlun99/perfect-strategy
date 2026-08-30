<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Blackjack')</title>
    @stack('head')
</head>
<body class="@yield('body-class')">
    @yield('content')
</body>
</html>
